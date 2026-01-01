// src/screens/chat/hooks/useChatMessaging.ts

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { MutableRefObject } from 'react';

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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current =
      conversationId;
  }, [conversationId]);

  const resolveServerId = useCallback(
    (id: string) => {
      const msg = messagesRef.current.find(
        (m) => m.id === id || m.clientId === id,
      );
      return msg?.serverId;
    },
    [],
  );

  const mapServerMessage = useCallback(
    (serverMsg: any): ChatMessage => {
      const mapAttachments = (list: any[]) =>
        list.map((a) => ({
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

      return {
        id: serverMsg.id ?? serverMsg._id,
        clientId: serverMsg.clientId,
        serverId: serverMsg.id ?? serverMsg._id,
        conversationId: serverMsg.conversationId,
        senderId: serverMsg.senderId,
        senderName: serverMsg.senderName,
        text: serverMsg.text ?? serverMsg.ciphertext ?? '',
        kind: (serverMsg.kind as MessageKind) ?? 'text',
        createdAt: serverMsg.createdAt ?? new Date().toISOString(),
        attachments: serverMsg.attachments
          ? mapAttachments(serverMsg.attachments)
          : [],
        replyToId: serverMsg.replyToId ?? null,
        status: 'sent' as MessageStatus,
        roomId: String(storageRoomId),
        fromMe: serverMsg.senderId === currentUserId,
      };
    },
    [storageRoomId, currentUserId],
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

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected) || !conversationId)
      return;

    joinConversation(conversationId);

    const markRead = async () => {
      const roomId = String(storageRoomId);
      const updated = await bulkUpdateMessages(roomId, (m) =>
        !m.fromMe && m.conversationId === conversationId
          ? { ...m, status: 'read' }
          : m,
      );
      replaceMessages(updated);
    };
    markRead();

    const lastLocal = messagesRef.current
      .filter((m) => m.conversationId === conversationId)
      .map((m) => m.createdAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];

    socket.timeout(5000).emit(
      'chat.history',
      {
        conversationId: String(conversationId),
        limit: lastLocal ? 200 : 50,
        after: lastLocal || undefined,
      },
      (err: any, ack?: any) => {
        if (err || !ack?.ok) return;
        const messages = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
        if (!messages.length) return;
        replaceMessages(messages.map((m: any) => mapServerMessage(m)));
      },
    );

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

      const payload = {
        conversationId: String(convId),
        kind:
          (message.kind as MessageKind) ??
          'text',
        clientId,
        text:
          message.text ??
          message.styledText?.text ??
          undefined,
        replyToId: message.replyToId ?? null,
        attachments: message.attachments
          ? normalizeAttachments(message.attachments)
          : undefined,
        contacts: message.contacts ?? undefined,
        poll: message.poll ?? undefined,
        event: message.event ?? undefined,
        styledText: message.styledText ?? null,
        sticker: message.sticker ?? null,
        voice: message.voice
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
  }, [socket, isConnected, attemptFlushQueue]);

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

      const exists =
        messagesRef.current.some(
          (m) =>
            m.clientId &&
            serverMsg.clientId &&
            m.clientId ===
              serverMsg.clientId,
        );

      if (exists) return;

      const msg = mapServerMessage(serverMsg);

      replaceMessages([
        ...messagesRef.current,
        msg,
      ]);
    };

    socket.on(
      'chat.message',
      onIncomingMessage,
    );

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

    return () => {
      socket.off(
        'chat.message',
        onIncomingMessage,
      );
      socket.off('chat.edit', onEdit);
      socket.off('chat.delete', onDelete);
    };
  }, [socket, replaceMessages, storageRoomId, mapServerMessage]);

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
      log('conversation.created'),
    );
    socket.on(
      'conversation.updated',
      log('conversation.updated'),
    );
    socket.on(
      'conversation.last_message',
      log('conversation.last_message'),
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
    sendTyping: (isTyping: boolean) => {
      const convId =
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !convId) return;
      socket.emit('chat.typing', {
        conversationId: String(convId),
        isTyping,
      });
    },
    socket,
    isSocketConnected: isConnected,
  };
}
