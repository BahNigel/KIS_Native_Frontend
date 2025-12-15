// src/screens/chat/hooks/useChatMessaging.ts

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { MutableRefObject } from 'react';

import {
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
      if (!sendOverNetworkImplRef.current) {
        console.warn(
          '[useChatMessaging] send impl not ready',
        );
        return false;
      }

      return sendOverNetworkImplRef.current(
        message,
      );
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

        // ❗ DO NOT FAIL IF SOCKET IS NOT READY
        if (!socket || !isConnected || !chat) {
          console.log(
            '[sendOverNetworkImpl] socket not ready → queue',
          );
          return false;
        }

        const convId =
          message.conversationId ??
          conversationId ??
          String(storageRoomId);

        if (!convId) return false;

        if (!message.clientId) {
          message.clientId = `${currentUserId}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
        }

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
          clientId: message.clientId,
          replyToId: message.replyToId ?? null,
          attachments:
            message.attachments ?? [],
          contacts: message.contacts ?? null,
          poll: message.poll ?? null,
          event: message.event ?? null,
          styledText:
            message.styledText ?? null,
          sticker: message.sticker ?? null,
          voice: message.voice ?? null,
        };

        return new Promise<boolean>(
          (resolve) => {
            socket
              .timeout(5000)
              .emit(
                'chat.send',
                payload,
                (
                  err: any,
                  ack: {
                    ok?: boolean;
                    success?: boolean;
                  },
                ) => {
                  if (err) {
                    console.warn(
                      '[chat.send] error',
                      err,
                    );
                    return resolve(false);
                  }

                  resolve(
                    Boolean(
                      ack?.ok ||
                        ack?.success,
                    ),
                  );
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
