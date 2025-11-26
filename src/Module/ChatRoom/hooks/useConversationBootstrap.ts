// src/screens/chat/hooks/useConversationBootstrap.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import type { ChatRoomPageProps } from '../chatTypes';

type ChatType = ChatRoomPageProps['chat'];

export function useConversationBootstrap(
  chat: ChatType | undefined,
  authToken: string | null,
) {
  const isDirectChat = useMemo(
    () =>
      !!chat &&
      (chat.kind === 'direct' ||
        (chat as any).isContactChat ||
        (!chat.isGroup &&
          !(chat as any).isGroupChat &&
          !(chat as any).isCommunityChat)),
    [chat],
  );

  const getInitialConversationId = useCallback((): string | null => {
    if (!chat) return null;

    if ((chat as any).conversationId) {
      return String((chat as any).conversationId);
    }

    if (!isDirectChat && chat.id) {
      return String(chat.id);
    }

    return null;
  }, [chat, isDirectChat]);

  const [conversationId, setConversationId] = useState<string | null>(
    getInitialConversationId,
  );

  useEffect(() => {
    if (!chat) {
      setConversationId(null);
      return;
    }
    if (conversationId) return;

    const initial = getInitialConversationId();
    if (initial) {
      console.log('[ChatRoomPage] Setting conversationId from chat:', initial);
      setConversationId(initial);
    }
  }, [chat, conversationId, getInitialConversationId]);

  const storageRoomId = chat?.id ?? 'local-room';

  const ensureConversationId = useCallback(
    async (previewText?: string): Promise<string | null> => {
      if (!chat) return null;

      let currentConversationId: string | null =
        conversationId != null ? String(conversationId) : null;

      console.log(
        '[ChatRoomPage] ensureConversationId called. Current conversationId:',
        currentConversationId,
        'isDirectChat:',
        isDirectChat,
      );

      // NON-DIRECT CHATS
      if (!isDirectChat) {
        const existingId =
          (chat as any).conversationId ??
          chat.id ??
          null;

        if (!existingId) {
          console.warn(
            '[ChatRoomPage] Non-direct chat without id/conversationId:',
            chat,
          );
          return null;
        }

        const idStr = String(existingId);

        if (idStr !== currentConversationId) {
          console.log(
            '[ChatRoomPage] Using non-direct conversationId from chat:',
            idStr,
          );
          currentConversationId = idStr;
          setConversationId(idStr);
        }

        return idStr;
      }

      // DIRECT CHATS
      if (currentConversationId) {
        return currentConversationId;
      }

      const chatIdStr = chat.id != null ? String(chat.id) : null;
      const isNewContact = chatIdStr?.startsWith('newContact-') ?? false;

      if (!isNewContact && chatIdStr) {
        console.log(
          '[ChatRoomPage] Using existing direct conversationId from chat.id:',
          chatIdStr,
        );
        currentConversationId = chatIdStr;
        setConversationId(chatIdStr);
        return chatIdStr;
      }

      if (!authToken) {
        Alert.alert(
          'Not signed in',
          'Please sign in again before sending messages.',
        );
        return null;
      }

      const participantsPhones: string[] = (chat.participants ?? [])
        .filter(Boolean)
        .map((p) => String(p).trim());

      if (!participantsPhones.length) {
        Alert.alert(
          'Cannot start chat',
          'No participant phone numbers found for this chat.',
        );
        return null;
      }

      const conversationName = chat.name || 'New chat';
      const last_message_preview = previewText?.trim() ?? '';

      const payload = {
        type: 'direct',
        title: conversationName,
        last_message_preview,
        participants: participantsPhones,
        user_id: { participants: participantsPhones },
        client_context: {
          temp_chat_id: String(chat.id),
          source: 'mobile',
        },
      };

      console.log('[ChatRoomPage] Creating conversation with payload:', payload);

      try {
        const res = await postRequest(
          ROUTES.chat.directConversation,
          payload,
          {
            errorMessage: 'conversation.',
          },
        );

        const newId = res?.data?.id;
        if (!newId) {
          console.warn(
            '[ChatRoomPage] directConversation: no id returned in response',
            res,
          );
          Alert.alert(
            'Error',
            'Conversation created but id is missing from server response.',
          );
          return null;
        }

        const idStr = String(newId);
        console.log('[ChatRoomPage] Final direct conversationId:', idStr);

        currentConversationId = idStr;
        setConversationId(idStr);

        return idStr;
      } catch (e) {
        console.warn('[ChatRoomPage] ensureConversationId error', e);
        Alert.alert(
          'Network error',
          'Could not start this conversation. Please check your connection.',
        );
        return null;
      }
    },
    [authToken, chat, conversationId, isDirectChat],
  );

  return {
    isDirectChat,
    conversationId,
    storageRoomId,
    ensureConversationId,
    setConversationId,
  };
}
