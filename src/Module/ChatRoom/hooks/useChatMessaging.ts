// src/screens/chat/hooks/useChatMessaging.ts
import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useChatPersistence, type SendOverNetworkFn } from './useChatPersistence';
import { useChatSocket } from '../componets/useChatSocket';
import type { ChatMessage, ChatRoomPageProps } from '../chatTypes';

type ChatType = ChatRoomPageProps['chat'];

type UseChatMessagingParams = {
  chat: ChatType | undefined;
  authToken: string | null;
  storageRoomId: string | number;
  currentUserId: string;
  currentUserName: string | null;
  conversationId: string | null;
};

export function useChatMessaging({
  chat,
  authToken,
  storageRoomId,
  currentUserId,
  currentUserName,
  conversationId,
}: UseChatMessagingParams) {
  const sendOverNetworkImplRef = useRef<SendOverNetworkFn | null>(null);

  const sendOverNetwork: SendOverNetworkFn = useCallback(
    async (message) => {
      if (!sendOverNetworkImplRef.current) {
        console.log(
          '[ChatRoomPage] sendOverNetwork proxy: implementation not ready yet, skipping',
        );
        return false;
      }
      return sendOverNetworkImplRef.current(message);
    },
    [],
  );

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
    roomId: storageRoomId,
    currentUserId,
    sendOverNetwork,
  });

  const messagesRef: MutableRefObject<ChatMessage[]> = useRef<ChatMessage[]>(
    messages,
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    console.log('[ChatRoomPage] messages updated:', messages);
  }, [messages]);

  const { isConnected, socketRef } = useChatSocket({
    authToken,
    roomId: storageRoomId,
    currentUserId,
    replaceMessages,
    messagesRef,
  });

  const sendOverNetworkImpl = useCallback<SendOverNetworkFn>(
    async (message) => {
      const socket = socketRef.current;
      if (!socket || !isConnected || !chat) {
        console.log(
          '[ChatRoomPage] sendOverNetworkImpl: no socket / not connected / no chat',
        );
        return false;
      }

      const convIdFromMessage =
        (message as any).conversationId ?? conversationId;

      if (!convIdFromMessage) {
        console.warn(
          '[ChatRoomPage] sendOverNetworkImpl called without conversationId',
        );
        return false;
      }

      const ciphertext =
        message.text ??
        message.styledText?.text ??
        '';

      const payload = {
        conversationId: String(convIdFromMessage),
        senderId: String(
          (message as any).senderId ?? currentUserId ?? 'unknown',
        ),
        senderName:
          (message as any).senderName ??
          currentUserName ??
          null,
        ciphertext,
        attachments: (message as any).attachments ?? [],
        replyToId: (message as any).replyToId ?? null,
      };

      console.log('[ChatRoomPage] chat.send payload:', payload);

      return new Promise<boolean>((resolve) => {
        socket
          .timeout(5000)
          .emit('chat.send', payload, (err: unknown, ack: any) => {
            if (err) {
              console.warn('chat.send timeout/error', err);
              resolve(false);
              return;
            }
            resolve(!!ack?.ok || !!ack?.success);
          });
      });
    },
    [chat, conversationId, currentUserId, currentUserName, isConnected, socketRef],
  );

  useEffect(() => {
    sendOverNetworkImplRef.current = sendOverNetworkImpl;
  }, [sendOverNetworkImpl]);

  useEffect(() => {
    if (isConnected) {
      attemptFlushQueue();
    }
  }, [attemptFlushQueue, isConnected]);

  const handleNetworkBackOnline = useCallback(() => {
    attemptFlushQueue();
  }, [attemptFlushQueue]);

  return {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    isConnected,
    socketRef,
    handleNetworkBackOnline,
  };
}
