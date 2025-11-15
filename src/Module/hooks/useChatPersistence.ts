// src/screens/chat/hooks/useChatPersistence.ts

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../ChatRoom/ChatRoomPage';
import {
  loadMessages,
  saveMessages,
} from '@/Module/Storage/chatStorage';

export type SendOverNetworkFn = (message: ChatMessage) => Promise<boolean>;

type UseChatPersistenceOptions = {
  roomId: string;
  currentUserId: string;
  sendOverNetwork?: SendOverNetworkFn; // optional, safe stub
};

export type UseChatPersistenceResult = {
  messages: ChatMessage[];
  isLoading: boolean;
  sendTextMessage: (
    text: string,
    extra?: Partial<ChatMessage>,
  ) => Promise<void>;
  sendRichMessage: (payload: Partial<ChatMessage>) => Promise<void>;
  editMessage: (
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => Promise<void>;
  softDeleteMessage: (messageId: string) => Promise<void>;
  replyToMessage: (
    parent: ChatMessage,
    text: string,
    extra?: Partial<ChatMessage>,
  ) => Promise<void>;
  attemptFlushQueue: () => Promise<void>;
  replaceMessages: (next: ChatMessage[]) => Promise<void>;
};

const createLocalId = () =>
  `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export function useChatPersistence(
  options: UseChatPersistenceOptions,
): UseChatPersistenceResult {
  const { roomId, currentUserId, sendOverNetwork } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1) Initial load from device
  useEffect(() => {
    let mounted = true;

    (async () => {
      setIsLoading(true);
      const loaded = await loadMessages(roomId);

      if (!mounted) return;
      // Sort by createdAt if needed
      loaded.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setMessages(loaded);
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [roomId]);

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      setMessages(next);
      await saveMessages(roomId, next);
    },
    [roomId],
  );

  // 2) Sending helpers

  const sendRichMessage = useCallback(
    async (payload: Partial<ChatMessage>) => {
      // Guard: make sure we actually have something to send
      const hasText =
        typeof payload.text === 'string' &&
        payload.text.trim().length > 0;

      const hasNonTextContent = Boolean(
        payload.voice || payload.styledText || payload.sticker,
      );

      if (!hasText && !hasNonTextContent) {
        return;
      }

      const now = new Date().toISOString();
      const draft: ChatMessage = {
        // Required core fields
        id: createLocalId(),
        roomId,
        senderId: currentUserId,
        createdAt: now,
        fromMe: true,
        status: 'pending', // offline-first

        // Optional business fields coming from composer
        ...payload,
      };

      const local = [...messages, draft];
      await persist(local);

      if (!sendOverNetwork) {
        // No backend yet – stay pending but safely stored.
        return;
      }

      const sentOk = await sendOverNetwork(draft).catch((e) => {
        console.warn('[useChatPersistence] sendOverNetwork error', e);
        return false;
      });

      if (!sentOk) {
        // Stay pending for later retry
        return;
      }

      // Mark as sent
      const updated = local.map((m) =>
        m.id === draft.id
          ? { ...m, status: 'sent' as ChatMessage['status'], isLocalOnly: false }
          : m,
      );
      await persist(updated);
    },
    [messages, persist, roomId, currentUserId, sendOverNetwork],
  );

  const sendTextMessage = useCallback(
    async (text: string, extra?: Partial<ChatMessage>) => {
      if (!text.trim()) return;

      await sendRichMessage({
        text: text.trim(),
        kind: (extra?.kind as ChatMessage['kind']) ?? 'text',
        ...extra,
      });
    },
    [sendRichMessage],
  );

  // 3) Edit / delete / reply

  const editMessage = useCallback(
    async (messageId: string, patch: Partial<ChatMessage>) => {
      const next: ChatMessage[] = messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              ...patch,
              isEdited: true,
              updatedAt: new Date().toISOString(),
              // Editing marks it pending again to sync with backend when ready
              status: 'pending' as ChatMessage['status'],
            }
          : m,
      );
      await persist(next);
    },
    [messages, persist],
  );

  const softDeleteMessage = useCallback(
    async (messageId: string) => {
      const next: ChatMessage[] = messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isDeleted: true,
              text: '',
              // Clear rich content (sticker / styled / voice) so UI shows placeholder
              styledText: undefined,
              voice: undefined,
              sticker: undefined,
              status: 'pending' as ChatMessage['status'],
            }
          : m,
      );
      await persist(next);
    },
    [messages, persist],
  );

  const replyToMessage = useCallback(
    async (
      parent: ChatMessage,
      text: string,
      extra?: Partial<ChatMessage>,
    ) => {
      await sendTextMessage(text, {
        ...extra,
        replyToId: parent.id,
      });
    },
    [sendTextMessage],
  );

  // 4) Flush queue when WS is connected (now or in the future)
  const attemptFlushQueue = useCallback(async () => {
    if (!sendOverNetwork) {
      // Backend not wired yet → do nothing but don't crash
      return;
    }

    const current = [...messages];
    const pending = current.filter(
      (m) => m.status === 'pending' || m.status === 'failed',
    );

    if (!pending.length) return;

    const next = [...current];

    for (const msg of pending) {
      const ok = await sendOverNetwork(msg).catch((e) => {
        console.warn('[useChatPersistence] flush error', e);
        return false;
      });

      const idx = next.findIndex((m) => m.id === msg.id);
      if (idx === -1) continue;

      if (ok) {
        next[idx] = {
          ...next[idx],
          status: 'sent' as ChatMessage['status'],
          isLocalOnly: false,
        };
      } else {
        next[idx] = {
          ...next[idx],
          status: 'failed' as ChatMessage['status'],
        };
      }
    }

    await persist(next);
  }, [messages, persist, sendOverNetwork]);

  const replaceMessages = useCallback(
    async (next: ChatMessage[]) => {
      await persist(next);
    },
    [persist],
  );

  return {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    replaceMessages,
  };
}
