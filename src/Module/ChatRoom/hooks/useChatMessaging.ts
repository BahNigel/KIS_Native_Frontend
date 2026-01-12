// src/screens/chat/hooks/useChatMessaging.ts

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { MutableRefObject } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

import {
  SendOverNetworkResult,
  useChatPersistence,
  type SendOverNetworkFn,
} from './useChatPersistence';
import { bulkUpdateMessages } from '../Storage/chatStorage';

import type {
  ChatMessage,
  ChatRoomPageProps,
  MessageKind,
  MessageStatus,
} from '../chatTypes';

import { useSocket } from '../../../../SocketProvider';
import { encryptPayloadForRecipients, decryptFromUser, ensureDeviceId } from '@/security/e2ee';
import { participantsToIds } from '../messagesUtils';

/* ========================================================================
 * TYPES
 * ===================================================================== */

type ChatType = ChatRoomPageProps['chat'];

type UseChatMessagingParams = {
  chat: ChatType | undefined;
  storageRoomId: string | number;
  currentUserId: string;
  currentUserName: string | null;
  conversationId: string | null;
};

/* ========================================================================
 * HOOK
 * ===================================================================== */

export function useChatMessaging({
  chat,
  storageRoomId,
  currentUserId,
  currentUserName,
  conversationId,
}: UseChatMessagingParams) {
  /* ---------------------------------------------------------------------
   * SOCKET
   * ------------------------------------------------------------------ */

  const { socket, isConnected } = useSocket();

  /* ---------------------------------------------------------------------
   * SEND IMPLEMENTATION REF
   * ------------------------------------------------------------------ */

  const sendOverNetworkImplRef =
    useRef<SendOverNetworkFn | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historySyncRef = useRef<number>(0);
  const flushInFlightRef = useRef(false);
  const historyLoadRef = useRef(false);

  const sendOverNetwork: SendOverNetworkFn =
  useCallback(async (message) => {
    const impl = sendOverNetworkImplRef.current;

    if (!impl) {
      console.warn(
        '[useChatMessaging] send impl not ready',
      );
      return { ok: false };
    }

    return impl(message);
  }, []);


  /* ---------------------------------------------------------------------
   * CHAT PERSISTENCE
   * ------------------------------------------------------------------ */

  const {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    replaceMessages,
    retryMessage,
  } = useChatPersistence({
    roomId: String(storageRoomId),
    currentUserId,
    sendOverNetwork,
  });

  /* ---------------------------------------------------------------------
   * REFS (AVOID STALE CLOSURES)
   * ------------------------------------------------------------------ */

  const messagesRef: MutableRefObject<
    ChatMessage[]
  > = useRef(messages);

  const conversationIdRef =
    useRef<string | null>(conversationId);
  const deviceIdRef = useRef<string>('');
  const logE2EEDebug = (...args: any[]) => {
    console.log('[E2EE-DECRYPT]', ...args);
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (deviceIdRef.current) return;
    ensureDeviceId()
      .then((id) => {
        deviceIdRef.current = id;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    conversationIdRef.current =
      conversationId;
  }, [conversationId]);

  /* ---------------------------------------------------------------------
   * E2EE CACHE (prevents /auth/e2ee/keys spam)
   * ------------------------------------------------------------------ */

  const e2eeMetaCacheRef = useRef<Map<string, { at: number; meta: any }>>(
    new Map(),
  );

  const getCachedEncryptionMetaForRecipients = useCallback(
    async (recipientIds: string[], payload: any) => {
      // Cache per recipients set for a short TTL.
      // This avoids refetching /e2ee/keys for every send/flush attempt.
      const ttlMs = 5 * 60 * 1000; // 5 min
      const key = [...recipientIds].sort().join(',');

      const hit = e2eeMetaCacheRef.current.get(key);
      if (hit && Date.now() - hit.at < ttlMs) {
        return hit.meta;
      }

      const meta = await encryptPayloadForRecipients(
        String(currentUserId ?? ''),
        recipientIds,
        payload,
      );

      e2eeMetaCacheRef.current.set(key, { at: Date.now(), meta });
      return meta;
    },
    [currentUserId],
  );

  const resolveServerId = useCallback(
    (id: string) => {
      const msg = messagesRef.current.find(
        (m) => m.id === id || m.clientId === id,
      );
      return msg?.serverId;
    },
    [],
  );

  const normalizeReactions = useCallback((input: any) => {
    if (!input) return undefined;
    if (Array.isArray(input)) {
      return input.reduce((acc: Record<string, string[]>, item: any) => {
        const emoji = item?.emoji;
        const userId = item?.userId;
        if (!emoji || !userId) return acc;
        if (!acc[emoji]) acc[emoji] = [];
        if (!acc[emoji].includes(userId)) {
          acc[emoji].push(userId);
        }
        return acc;
      }, {});
    }
    if (typeof input === 'object') {
      return input as Record<string, string[]>;
    }
    return undefined;
  }, []);

  const mapServerMessage = useCallback(
    (serverMsg: any): ChatMessage => {
      const mapAttachments = (list: any[]) =>
        list.map((raw) => {
          const a = raw?.attachment ?? raw ?? {};
          return {
            id: a.id ?? a.key,
            url: a.url ?? a.uri,
            originalName: a.originalName ?? a.name ?? a.filename,
            mimeType: a.mimeType ?? a.mime ?? a.contentType,
            size: a.size ?? a.sizeBytes,
            kind: a.kind,
            width: a.width,
            height: a.height,
            durationMs: a.durationMs,
            thumbUrl: a.thumbUrl,
          };
        });

      const senderId =
        serverMsg.senderId != null ? String(serverMsg.senderId) : '';

      const normalizedConversationId =
        serverMsg.conversationId ??
        serverMsg.conversation_id ??
        conversationId ??
        String(storageRoomId);

      const styledText =
        serverMsg.styledText ?? serverMsg.styled_text ?? null;

      const contacts =
        Array.isArray(serverMsg.contacts)
          ? serverMsg.contacts.map((c: any, idx: number) => ({
              id: String(c?.id ?? c?.phone ?? `contact_${idx + 1}`),
              name: String(c?.name ?? c?.display_name ?? c?.phone ?? 'Contact'),
              phone: String(c?.phone ?? c?.phoneNumber ?? ''),
            }))
          : undefined;

      const poll =
        serverMsg.poll && typeof serverMsg.poll === 'object'
          ? {
              id: serverMsg.poll.id ?? undefined,
              question: String(serverMsg.poll.question ?? ''),
              allowMultiple: !!serverMsg.poll.allowMultiple,
              expiresAt: serverMsg.poll.expiresAt ?? null,
              options: Array.isArray(serverMsg.poll.options)
                ? serverMsg.poll.options.map((opt: any, idx: number) => ({
                    id: String(opt?.id ?? `opt_${idx + 1}`),
                    text: String(opt?.text ?? opt?.label ?? ''),
                    votes:
                      typeof opt?.votes === 'number' ? opt.votes : undefined,
                  }))
                : [],
            }
          : undefined;

      const rawEvent =
        serverMsg.event ?? serverMsg.event_data ?? serverMsg.eventData ?? null;
      const event =
        rawEvent && typeof rawEvent === 'object'
          ? {
              id: rawEvent.id ?? undefined,
              title: String(rawEvent.title ?? ''),
              description:
                rawEvent.description != null
                  ? String(rawEvent.description)
                  : undefined,
              location:
                rawEvent.location != null
                  ? String(rawEvent.location)
                  : undefined,
              startsAt:
                rawEvent.startsAt ??
                (rawEvent.date && rawEvent.time
                  ? `${rawEvent.date}T${rawEvent.time}:00`
                  : undefined),
              endsAt:
                rawEvent.endsAt ??
                (rawEvent.endDate && rawEvent.endTime
                  ? `${rawEvent.endDate}T${rawEvent.endTime}:00`
                  : undefined),
              reminderMinutes:
                typeof rawEvent.reminderMinutes === 'number'
                  ? rawEvent.reminderMinutes
                  : undefined,
            }
          : undefined;

      const rawText = serverMsg.text ?? '';
      const ciphertext = serverMsg.ciphertext ?? undefined;
      const hasEncrypted = !!(
        serverMsg.encryptionMeta ??
        serverMsg.encryption_meta ??
        ciphertext
      );
      if (serverMsg.encryptionMeta || serverMsg.encryption_meta) {
        logE2EEDebug('map:encrypted', { id: serverMsg.id ?? serverMsg._id, hasCiphertext: !!ciphertext });
      }
      const text = rawText || (hasEncrypted ? 'Encrypted message' : '');

      return {
        id: serverMsg.id ?? serverMsg._id,
        clientId: serverMsg.clientId,
        serverId: serverMsg.id ?? serverMsg._id,
        seq: typeof serverMsg.seq === 'number' ? serverMsg.seq : undefined,
        conversationId: normalizedConversationId,
        senderId,
        senderName: serverMsg.senderName,
        text,
        ciphertext,
        encryptionMeta: serverMsg.encryptionMeta ?? serverMsg.encryption_meta ?? undefined,
        kind: (serverMsg.kind as MessageKind) ?? 'text',
        createdAt:
          serverMsg.createdAt ??
          serverMsg.created_at ??
          new Date().toISOString(),
        attachments: serverMsg.attachments
          ? mapAttachments(serverMsg.attachments)
          : [],
        replyToId: serverMsg.replyToId ?? null,
        status: 'sent' as MessageStatus,
        roomId: String(storageRoomId),
        fromMe: senderId !== '' && senderId === String(currentUserId),
        reactions: normalizeReactions(serverMsg.reactions),
        styledText: styledText ?? undefined,
        contacts,
        poll,
        event,
      };
    },
    [storageRoomId, currentUserId, normalizeReactions, conversationId],
  );

  const decryptBatchIfNeeded = useCallback(
    async (incoming: ChatMessage[]) => {
      logE2EEDebug('batch:start', { count: incoming.length });

      const currentDeviceId = deviceIdRef.current;

      for (const msg of incoming) {
        if (msg.encryptionMeta?.e2ee !== 'signal') continue;

        const meta = msg.encryptionMeta;
        const recipients = Array.isArray(meta?.recipients)
          ? meta.recipients
          : null;

        logE2EEDebug('batch:message', {
          id: msg.id,
          serverId: msg.serverId,
          senderId: msg.senderId,
          currentUserId,
          currentDeviceId,
          recipientsCount: recipients ? recipients.length : 0,
          hasCiphertext: !!msg.ciphertext,
        });

        // Normalize senderDeviceId keys (server might store different casing)
        const senderDeviceId =
          meta?.senderDeviceId ??
          (meta as any)?.sender_device_id ??
          meta?.deviceId ??
          (meta as any)?.device_id ??
          '';

        if (!senderDeviceId) {
          logE2EEDebug('batch:missingSenderDevice', { id: msg.id });
          continue;
        }

        // ✅ deterministic selection:
        // prefer deviceId match, then fallback to userId match
        let recipientCipher: any = null;
        if (recipients && currentDeviceId) {
          recipientCipher =
            recipients.find(
              (r: any) => String(r?.deviceId) === String(currentDeviceId),
            ) ?? null;
        }
        if (!recipientCipher && recipients) {
          recipientCipher =
            recipients.find(
              (r: any) => String(r?.userId) === String(currentUserId),
            ) ?? null;
        }

        const ciphertext = recipientCipher?.ciphertext ?? msg.ciphertext;
        const type = recipientCipher?.type ?? meta?.type ?? 1;

        if (!ciphertext) {
          logE2EEDebug('batch:missingCipher', { id: msg.id });
          continue;
        }

        try {
          const plaintext = await decryptFromUser(
            String(msg.senderId ?? ''),
            String(senderDeviceId),
            String(ciphertext),
            Number(type),
          );

          let parsed: any = null;
          try {
            parsed = JSON.parse(plaintext);
          } catch {}

          const patch = {
            text: parsed?.text ?? plaintext,
            styledText: parsed?.styledText ?? msg.styledText,
            attachments: parsed?.attachments ?? msg.attachments,
            contacts: parsed?.contacts ?? msg.contacts,
            poll: parsed?.poll ?? msg.poll,
            event: parsed?.event ?? msg.event,
            voice: parsed?.voice ?? (msg as any).voice,
            sticker: parsed?.sticker ?? (msg as any).sticker,
            replyToId: parsed?.replyToId ?? msg.replyToId,
            kind: parsed?.kind ?? msg.kind,
          };

          const next = messagesRef.current.map((m) =>
            m.serverId === msg.serverId || m.id === msg.id
              ? { ...m, ...patch }
              : m,
          );
          replaceMessages(next);
        } catch (err) {
          console.warn('[E2EE] decrypt failed', err);
        }
      }

      return incoming;
    },
    [replaceMessages, currentUserId],
  );

  /* ---------------------------------------------------------------------
   * JOIN / LEAVE CONVERSATION
   * ------------------------------------------------------------------ */

  const joinConversation = useCallback(
    (convId?: string | null) => {
      if (!socket || !(isConnected || socket.connected) || !convId)
        return;

      socket.emit('chat.join', {
        conversationId: String(convId),
      });
    },
    [socket, isConnected],
  );

  const leaveConversation = useCallback(
    (convId?: string | null) => {
      if (!socket || !convId) return;

      socket.emit('chat.leave', {
        conversationId: String(convId),
      });
    },
    [socket],
  );

  const requestHistory = useCallback(
    (input: { after?: string; before?: string; limit?: number }) => {
      if (!socket || !(isConnected || socket.connected) || !conversationId) return;
      socket.timeout(5000).emit(
        'chat.history',
        {
          conversationId: String(conversationId),
          limit: input.limit,
          after: input.after,
          before: input.before,
        },
        (err: any, ack?: any) => {
          if (err || !ack?.ok) return;
          const items = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
          if (!items.length) return;
          const mapped = items.map((m: any) => mapServerMessage(m));
          replaceMessages(mapped);
          decryptBatchIfNeeded(mapped).then(replaceMessages);
        },
      );
    },
    [socket, isConnected, conversationId, replaceMessages, mapServerMessage, decryptBatchIfNeeded],
  );

  const requestHistoryBatch = useCallback(
    (input: { before?: string; limit?: number }) =>
      new Promise<any[]>((resolve) => {
        if (!socket || !(isConnected || socket.connected) || !conversationId) {
          resolve([]);
          return;
        }
        socket.timeout(5000).emit(
          'chat.history',
          {
            conversationId: String(conversationId),
            limit: input.limit,
            before: input.before,
          },
          (err: any, ack?: any) => {
            if (err || !ack?.ok) return resolve([]);
            const items = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
            resolve(items);
          },
        );
      }),
    [socket, isConnected, conversationId],
  );

  const loadFullHistory = useCallback(async () => {
    if (historyLoadRef.current) return;
    historyLoadRef.current = true;

    try {
      let before: string | undefined;
      let rounds = 0;
      let all: ChatMessage[] = [];
      while (rounds < 20) {
        const items = await requestHistoryBatch({ before, limit: 200 });
        if (!items.length) break;
        const mapped = items.map((m: any) => mapServerMessage(m));
        all = [...mapped, ...all];
        const oldest = items[0]?.createdAt ?? items[0]?.created_at;
        if (!oldest || oldest === before) break;
        before = oldest;
        rounds += 1;
      }
      if (all.length) {
        const decrypted = await decryptBatchIfNeeded(all);
        replaceMessages(decrypted);
      }
    } finally {
      historyLoadRef.current = false;
    }
  }, [requestHistoryBatch, replaceMessages, mapServerMessage, decryptBatchIfNeeded]);

  const syncHistory = useCallback(() => {
    const now = Date.now();
    if (now - historySyncRef.current < 3000) return;
    historySyncRef.current = now;

    const convId = conversationIdRef.current ?? conversationId;
    if (!convId) return;

    const byCreatedAt = (a: string, b: string) =>
      Date.parse(a) - Date.parse(b);

    const validServerMessages = messagesRef.current
      .filter((m) => m.conversationId === convId)
      .filter((m) => m.serverId && !m.isLocalOnly)
      .map((m) => m.createdAt)
      .filter((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)));

    const lastLocal =
      (validServerMessages.length
        ? validServerMessages.sort(byCreatedAt).slice(-1)[0]
        : undefined) ??
      messagesRef.current
        .filter((m) => m.conversationId === convId)
        .map((m) => m.createdAt)
        .filter((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)))
        .sort(byCreatedAt)
        .slice(-1)[0];

    if (lastLocal) {
      requestHistory({ after: lastLocal, limit: 200 });
      requestHistory({ before: lastLocal, limit: 50 });
      return;
    }

    requestHistory({ limit: 50 });
  }, [conversationId, requestHistory]);

  const markMessagesRead = useCallback(
    async (messageIds: string[]) => {
      if (!socket || !conversationId || !messageIds.length) return;
      const roomId = String(storageRoomId);
      const idSet = new Set(messageIds.map((id) => String(id)));
      const unread = messagesRef.current.filter((m) => {
        const msgId = (m as any).serverId ?? m.id ?? (m as any).clientId;
        return (
          !m.fromMe &&
          m.conversationId === conversationId &&
          m.status !== 'read' &&
          msgId != null &&
          idSet.has(String(msgId))
        );
      });

      if (!unread.length) return;

      for (const msg of unread) {
        if (!msg.serverId) continue;
        socket.emit('chat.receipt', {
          conversationId,
          messageId: msg.serverId,
          type: 'read',
        });
      }

      const updated = await bulkUpdateMessages(roomId, (m) => {
        const msgId = (m as any).serverId ?? m.id ?? (m as any).clientId;
        if (
          m.fromMe ||
          m.conversationId !== conversationId ||
          m.status === 'read' ||
          msgId == null ||
          !idSet.has(String(msgId))
        ) {
          return m;
        }
        return { ...m, status: 'read' };
      });
      replaceMessages(updated);
      DeviceEventEmitter.emit('conversation.read', {
        conversationId,
        readCount: unread.length,
      });
    },
    [socket, conversationId, storageRoomId, replaceMessages],
  );

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected) || !conversationId)
      return;

    joinConversation(conversationId);

    syncHistory();
    loadFullHistory();

    return () => {
      leaveConversation(conversationId);
    };
  }, [
    socket,
    isConnected,
    conversationId,
    joinConversation,
    leaveConversation,
    replaceMessages,
    mapServerMessage,
    storageRoomId,
    syncHistory,
    loadFullHistory,
  ]);

  /* ---------------------------------------------------------------------
   * SEND MESSAGE TO BACKEND (CORE FIX)
   * ------------------------------------------------------------------ */

  const sendOverNetworkImpl =
  useCallback<SendOverNetworkFn>(
    async (message) => {
      console.log(
        '[sendOverNetworkImpl]',
        'socket:',
        !!socket,
        'connected:',
        isConnected,
        'message:',
        message,
      );

      // Socket not ready → keep message queued locally
      if (!socket || !(isConnected || socket.connected) || !chat) {
        console.log(
          '[sendOverNetworkImpl] socket not ready → queue',
        );
        return { ok: false };
      }

      const convId =
        message.conversationId ??
        conversationId ??
        String(storageRoomId);

      if (!convId) {
        return { ok: false };
      }

      const isDirect = !!(chat as any)?.isDirect || !!(chat as any)?.isContactChat;
      const participantIds = participantsToIds((chat as any)?.participants);
      const recipientIds = isDirect
        ? participantIds.filter((id) => id && id !== String(currentUserId)).slice(0, 1)
        : participantIds.filter((id) => id && id !== String(currentUserId));

      const payloadForE2EE = {
        kind: (message.kind as MessageKind) ?? 'text',
        text: message.text ?? undefined,
        styledText: message.styledText ?? undefined,
        attachments: message.attachments ?? undefined,
        contacts: message.contacts ?? undefined,
        poll: message.poll ?? undefined,
        event: message.event ?? undefined,
        voice: message.voice ?? undefined,
        sticker: message.sticker ?? undefined,
        replyToId: message.replyToId ?? undefined,
      };

      let encryptedMeta: { encryptionMeta: any } | null = null;
      if (recipientIds.length) {
        try {
          // ✅ cached for 5min per recipient-set to reduce /e2ee/keys calls
          encryptedMeta = await getCachedEncryptionMetaForRecipients(
            recipientIds,
            payloadForE2EE,
          );
        } catch (err) {
          console.warn('[E2EE] encrypt failed, blocking plaintext send', err);
          return { ok: false };
        }
      }

      // clientId is REQUIRED by ChatMessage type
      const clientId = message.clientId;

      const normalizeAttachments = (attachments: any[]) =>
        attachments.map((a) => ({
          id: a.id,
          url: a.url,
          originalName: a.originalName ?? a.name,
          mimeType: a.mimeType ?? a.mime,
          size: a.size,
          kind: a.kind,
          width: a.width,
          height: a.height,
          durationMs: a.durationMs,
          thumbUrl: a.thumbUrl,
        }));

      const normalizeContacts = (list: any[] | undefined) =>
        Array.isArray(list)
          ? list.map((c, idx) => ({
              id: String(c?.id ?? c?.phone ?? `contact_${idx + 1}`),
              name: String(c?.name ?? c?.display_name ?? c?.phone ?? 'Contact'),
              phone: String(c?.phone ?? c?.phoneNumber ?? ''),
            }))
          : undefined;

      const normalizePoll = (input: any) => {
        if (!input || typeof input !== 'object') return undefined;
        const options = Array.isArray(input.options)
          ? input.options.map((opt: any, idx: number) => {
              if (typeof opt === 'string') {
                return { id: `opt_${idx + 1}`, text: opt };
              }
              return {
                id: String(opt?.id ?? `opt_${idx + 1}`),
                text: String(opt?.text ?? opt?.label ?? ''),
                votes:
                  typeof opt?.votes === 'number' ? opt.votes : undefined,
              };
            })
          : [];
        return {
          id: input.id ?? undefined,
          question: String(input.question ?? ''),
          options,
          allowMultiple: !!input.allowMultiple,
          expiresAt: input.expiresAt ?? null,
        };
      };

      const payload = {
        conversationId: String(convId),
        kind:
          (message.kind as MessageKind) ??
          'text',
        clientId,
        text:
          encryptedMeta
            ? undefined
            : message.ciphertext
              ? undefined
              : message.text ??
                message.styledText?.text ??
                undefined,
        ciphertext: message.ciphertext ?? undefined,
        encryptionMeta: encryptedMeta?.encryptionMeta ?? message.encryptionMeta ?? undefined,
        replyToId: message.replyToId ?? null,
        attachments: encryptedMeta
          ? undefined
          : message.attachments
            ? normalizeAttachments(message.attachments)
            : undefined,
        contacts: encryptedMeta ? undefined : normalizeContacts(message.contacts),
        poll: encryptedMeta ? undefined : normalizePoll(message.poll),
        event: encryptedMeta ? undefined : message.event ?? undefined,
        styledText: encryptedMeta ? null : message.styledText ?? null,
        sticker: encryptedMeta ? null : message.sticker ?? null,
        voice: encryptedMeta
          ? null
          : message.voice
            ? {
                ...message.voice,
                url:
                  (message.voice as any).url ??
                  (message.voice as any).uri,
              }
            : null,
      };

      console.log("checking message payload", payload);

      return new Promise<SendOverNetworkResult>(
        (resolve) => {
          socket
            .timeout(5000)
            .emit(
              'chat.send',
              payload,
              (
                err: any,
                ack?: any,
              ) => {
                if (err) {
                  console.warn('[chat.send] error', err);
                  return resolve({ ok: false });
                }

                const success = ack?.ok === true;

                if (!success) {
                  return resolve({ ok: false });
                }

                const ackPayload =
                  ack?.data?.ack ?? ack?.ack ?? null;
                const serverId =
                  ackPayload?.serverId ?? ack?.serverId ?? ack?.id;

                if (!serverId) {
                  console.warn(
                    '[chat.send] ACK missing serverId',
                    ack,
                  );
                  return resolve({ ok: false });
                }

                resolve({
                  ok: true,
                  serverId,
                  createdAt: ackPayload?.createdAt,
                  seq: typeof ackPayload?.seq === 'number' ? ackPayload.seq : undefined,
                });
              },
            );
        },
      );
    },
    [
      socket,
      isConnected,
      chat,
      conversationId,
      storageRoomId,
      currentUserId,
      currentUserName,
      getCachedEncryptionMetaForRecipients,
    ],
  );


  useEffect(() => {
    sendOverNetworkImplRef.current =
      sendOverNetworkImpl;
  }, [sendOverNetworkImpl]);

  /* ---------------------------------------------------------------------
   * FLUSH QUEUE WHEN SOCKET CONNECTS (🔥 FIX)
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected)) return;

    console.log(
      '[useChatMessaging] socket connected → flush queue',
    );

    attemptFlushQueue();
    syncHistory();
  }, [socket, isConnected, attemptFlushQueue, syncHistory]);

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected)) return;

    const interval = setInterval(() => {
      if (flushInFlightRef.current) return;
      const hasQueued = messagesRef.current.some(
        (m) => m.status === 'pending' || m.status === 'failed',
      );
      if (!hasQueued) return;
      flushInFlightRef.current = true;
      attemptFlushQueue()
        .catch(() => {})
        .finally(() => {
          flushInFlightRef.current = false;
        });
    }, 8000);

    return () => clearInterval(interval);
  }, [socket, isConnected, attemptFlushQueue]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!socket || !(isConnected || socket.connected)) return;
      attemptFlushQueue();
      syncHistory();
    });
    return () => sub.remove();
  }, [socket, isConnected, attemptFlushQueue, syncHistory]);

  /* ---------------------------------------------------------------------
   * RECEIVE REALTIME MESSAGES
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket) return;

    const onIncomingMessage = (
      serverMsg: any,
    ) => {
      const activeConv =
        conversationIdRef.current;

      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const matchIndex = messagesRef.current.findIndex((m) => {
        if (serverMsg.clientId && m.clientId && m.clientId === serverMsg.clientId) return true;
        if ((serverMsg.id ?? serverMsg._id) && m.serverId && m.serverId === (serverMsg.id ?? serverMsg._id)) return true;
        if (!serverMsg.clientId && String(serverMsg.senderId ?? '') === String(currentUserId) && m.fromMe && m.status === 'pending') return true;
        return false;
      });

      if (matchIndex >= 0) {
        const next = messagesRef.current.map((m, idx) =>
          idx === matchIndex
            ? {
                ...m,
                serverId: serverMsg.id ?? serverMsg._id ?? m.serverId,
                status: 'sent' as MessageStatus,
                isLocalOnly: false,
              }
            : m,
        );
        replaceMessages(next);
        return;
      }

      logE2EEDebug('incoming:raw', { id: serverMsg.id ?? serverMsg._id, hasEncryptionMeta: !!(serverMsg.encryptionMeta || serverMsg.encryption_meta) });
      const msg = mapServerMessage(serverMsg);

      if (!msg.fromMe && msg.serverId) {
        try {
          socket.emit('chat.receipt', {
            conversationId: String(msg.conversationId),
            messageId: msg.serverId,
            type: 'delivered',
          });
        } catch {}
      }

      replaceMessages([
        ...messagesRef.current,
        msg,
      ]);

      // Decrypt incoming encrypted messages using the same deterministic logic
      if (msg.encryptionMeta?.e2ee === 'signal') {
        const meta = msg.encryptionMeta;
        const currentDeviceId = deviceIdRef.current;
        const recipients = Array.isArray(meta?.recipients) ? meta.recipients : null;

        logE2EEDebug('incoming:message', {
          id: msg.id,
          serverId: msg.serverId,
          senderId: msg.senderId,
          currentUserId,
          currentDeviceId,
          recipientsCount: recipients ? recipients.length : 0,
        });

        const senderDeviceId =
          meta?.senderDeviceId ??
          (meta as any)?.sender_device_id ??
          meta?.deviceId ??
          (meta as any)?.device_id ??
          '';

        let recipientCipher: any = null;
        if (recipients && currentDeviceId) {
          recipientCipher =
            recipients.find((r: any) => String(r?.deviceId) === String(currentDeviceId)) ?? null;
        }
        if (!recipientCipher && recipients) {
          recipientCipher =
            recipients.find((r: any) => String(r?.userId) === String(currentUserId)) ?? null;
        }

        const ciphertext = recipientCipher?.ciphertext ?? msg.ciphertext;
        const type = recipientCipher?.type ?? meta?.type ?? 1;

        if (senderDeviceId && ciphertext) {
          decryptFromUser(
            String(msg.senderId ?? ''),
            String(senderDeviceId),
            String(ciphertext),
            Number(type),
          )
            .then((plaintext) => {
              let parsed: any = null;
              try {
                parsed = JSON.parse(plaintext);
              } catch {}
              const next = messagesRef.current.map((m) =>
                m.serverId === msg.serverId || m.id === msg.id
                  ? {
                      ...m,
                      text: parsed?.text ?? plaintext,
                      styledText: parsed?.styledText ?? m.styledText,
                      attachments: parsed?.attachments ?? m.attachments,
                      contacts: parsed?.contacts ?? m.contacts,
                      poll: parsed?.poll ?? m.poll,
                      event: parsed?.event ?? m.event,
                      voice: parsed?.voice ?? (m as any).voice,
                      sticker: parsed?.sticker ?? (m as any).sticker,
                      replyToId: parsed?.replyToId ?? m.replyToId,
                      kind: parsed?.kind ?? m.kind,
                    }
                  : m,
              );
              replaceMessages(next);
            })
            .catch((err) => {
              console.warn('[E2EE] decrypt failed', err);
            });
        } else {
          logE2EEDebug('incoming:missingCipher', { senderDeviceId, hasCipher: !!ciphertext });
        }
      }
    };

    socket.on(
      'chat.message',
      onIncomingMessage,
    );

    const onReceipt = (payload: any) => {
      const conversationId = payload?.conversationId;
      const messageId = payload?.messageId ?? payload?.id;
      const type = payload?.type;
      if (!conversationId || !messageId || !type) return;

      const roomId = String(storageRoomId);
      const status =
        type === 'read'
          ? 'read'
          : type === 'delivered'
          ? 'delivered'
          : undefined;

      if (!status) return;
      bulkUpdateMessages(roomId, (m) =>
        m.serverId === messageId || m.id === messageId
          ? { ...m, status }
          : m,
      ).then(replaceMessages);
    };

    socket.on('chat.message_receipt', onReceipt);

    const onEdit = (serverMsg: any) => {
      const activeConv =
        conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const id =
        serverMsg.id ??
        serverMsg._id ??
        serverMsg.messageId;

      const next = messagesRef.current.map(
        (m) =>
          m.serverId === id || m.id === id
            ? {
                ...m,
                text:
                  serverMsg.text ??
                  m.text,
                styledText:
                  serverMsg.styledText ??
                  m.styledText,
                isEdited: true,
                updatedAt:
                  serverMsg.updatedAt ??
                  new Date().toISOString(),
              }
            : m,
      );

      replaceMessages(next);
    };

    const onDelete = (serverMsg: any) => {
      const activeConv =
        conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const id =
        serverMsg.id ??
        serverMsg._id ??
        serverMsg.messageId;

      const next = messagesRef.current.map(
        (m) =>
          m.serverId === id || m.id === id
            ? {
                ...m,
                isDeleted: true,
                text: '',
                styledText: undefined,
                voice: undefined,
                sticker: undefined,
                attachments: [],
              }
            : m,
      );

      replaceMessages(next);
    };

    socket.on('chat.edit', onEdit);
    socket.on('chat.delete', onDelete);

    const onReaction = (serverMsg: any) => {
      const activeConv =
        conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const id =
        serverMsg.id ??
        serverMsg._id ??
        serverMsg.messageId;
      if (!id) return;

      const reactions = normalizeReactions(serverMsg.reactions);
      const roomId = String(storageRoomId);
      bulkUpdateMessages(roomId, (m) =>
        m.serverId === id || m.id === id
          ? { ...m, reactions }
          : m,
      ).then(replaceMessages);
    };

    socket.on('chat.message_reaction', onReaction);

    return () => {
      socket.off(
        'chat.message',
        onIncomingMessage,
      );
      socket.off('chat.message_receipt', onReceipt);
      socket.off('chat.edit', onEdit);
      socket.off('chat.delete', onDelete);
      socket.off('chat.message_reaction', onReaction);
    };
  }, [
    socket,
    replaceMessages,
    storageRoomId,
    mapServerMessage,
    conversationId,
    normalizeReactions,
    currentUserId,
  ]);

  /* ---------------------------------------------------------------------
   * CONVERSATION FAN-OUT EVENTS
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket) return;

    const log =
      (name: string) => (p: any) =>
        console.log(`[WS] ${name}`, p);

    socket.on(
      'conversation.created',
      (payload: any) => {
        log('conversation.created')(payload);
        DeviceEventEmitter.emit('conversation.refresh');
      },
    );
    socket.on(
      'conversation.updated',
      (payload: any) => {
        log('conversation.updated')(payload);
        DeviceEventEmitter.emit('conversation.refresh');
      },
    );
    socket.on(
      'conversation.last_message',
      (payload: any) => {
        log('conversation.last_message')(payload);
        DeviceEventEmitter.emit('conversation.refresh');
      },
    );

    return () => {
      socket.off('conversation.created');
      socket.off('conversation.updated');
      socket.off(
        'conversation.last_message',
      );
    };
  }, [socket]);

  /* ---------------------------------------------------------------------
   * RETURN API
   * ------------------------------------------------------------------ */

  const sendTyping = useCallback((isTyping: boolean) => {
    const convId =
      conversationIdRef.current ??
      String(storageRoomId);
    if (!socket || !convId) return;
    socket.emit('chat.typing', {
      conversationId: String(convId),
      isTyping,
    });
  }, [socket, storageRoomId]);

  return {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage: async (
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      await editMessage(messageId, patch);

      const convId =
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !convId) return;

      const serverId = resolveServerId(messageId);
      if (!serverId) return;
      socket.emit('chat.edit', {
        conversationId: String(convId),
        messageId: serverId,
        text: patch.text,
        styledText: patch.styledText,
      });
    },
    softDeleteMessage: async (
      messageId: string,
    ) => {
      await softDeleteMessage(messageId);

      const convId =
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !convId) return;

      const serverId = resolveServerId(messageId);
      if (!serverId) return;
      socket.emit('chat.delete', {
        conversationId: String(convId),
        messageId: serverId,
      });
    },
    replyToMessage,
    attemptFlushQueue,
    sendTyping,
    retryMessage: async (messageId: string) => {
      await retryMessage(messageId);
      await attemptFlushQueue();
    },
    sendReaction: (messageId: string, emoji: string, convId?: string | null) => {
      const resolvedConvId =
        convId ??
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !resolvedConvId || !messageId) return;
      socket.emit('chat.react', {
        conversationId: String(resolvedConvId),
        messageId,
        emoji,
      });
    },
    markMessagesRead,
    socket,
    isSocketConnected: isConnected,
  };
}
