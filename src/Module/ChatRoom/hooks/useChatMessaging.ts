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

  /* ---------------------------------------------------------------------
   * JOIN / LEAVE CONVERSATION
   * ------------------------------------------------------------------ */

  const joinConversation = useCallback(
    (convId?: string | null) => {
      if (!socket || !isConnected || !convId)
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
    if (!socket || !isConnected || !conversationId)
      return;

    joinConversation(conversationId);

    return () => {
      leaveConversation(conversationId);
    };
  }, [
    socket,
    isConnected,
    conversationId,
    joinConversation,
    leaveConversation,
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
      if (!socket || !isConnected || !chat) {
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

      const payload = {
        conversationId: String(convId),
        senderId: currentUserId,
        senderName: currentUserName,
        ciphertext:
          message.text ??
          message.styledText?.text ??
          '',
        kind:
          (message.kind as MessageKind) ??
          'text',
        clientId,
        replyToId: message.replyToId ?? null,
        attachments: message.attachments ?? [],
        contacts: message.contacts ?? null,
        poll: message.poll ?? null,
        event: message.event ?? null,
        styledText: message.styledText ?? null,
        sticker: message.sticker ?? null,
        voice: message.voice ?? null,
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
                ack?: {
                  ok?: boolean;
                  success?: boolean;
                  serverId?: string;
                  id?: string;
                },
              ) => {
                if (err) {
                  console.warn('[chat.send] error', err);
                  return resolve({ ok: false });
                }

                const success =
                  ack?.ok === true ||
                  ack?.success === true;

                if (!success) {
                  return resolve({ ok: false });
                }

                const serverId =
                  ack?.serverId ?? ack?.id;

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
    if (!socket || !isConnected) return;

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

      const msg: ChatMessage = {
        id: serverMsg.id,
        clientId: serverMsg.clientId,
        conversationId:
          serverMsg.conversationId,
        senderId: serverMsg.senderId,
        senderName: serverMsg.senderName,
        text:
          serverMsg.ciphertext ?? '',
        kind:
          (serverMsg.kind as MessageKind) ??
          'text',
        createdAt:
          serverMsg.createdAt ??
          new Date().toISOString(),
        attachments:
          serverMsg.attachments ?? [],
        replyToId:
          serverMsg.replyToId ?? null,
        status: 'sent' as MessageStatus,
        roomId: String(storageRoomId),
        fromMe: false,
      };

      replaceMessages([
        ...messagesRef.current,
        msg,
      ]);
    };

    socket.on(
      'chat.message',
      onIncomingMessage,
    );

    return () => {
      socket.off(
        'chat.message',
        onIncomingMessage,
      );
    };
  }, [socket, replaceMessages, storageRoomId]);

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
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    socket,
    isSocketConnected: isConnected,
  };
}
