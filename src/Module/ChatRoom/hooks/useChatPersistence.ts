// src/screens/chat/hooks/useChatPersistence.ts

import { useCallback, useEffect, useState } from 'react';
import { ChatMessage } from '../chatTypes';
import { loadMessages, saveMessages } from '../Storage/chatStorage';

// NOTE: message is a full ChatMessage that SHOULD contain:
// - conversationId (string)
// - senderId (string)
// - replyToId? (string | null)
// - attachments? (any[])
// plus any content fields (text, styledText, voice, sticker, etc.)
export type SendOverNetworkFn = (message: ChatMessage) => Promise<boolean>;

type UseChatPersistenceOptions = {
  roomId: string;            // storage key (per chat / conversation)
  currentUserId: string;
  sendOverNetwork?: SendOverNetworkFn; // wired from ChatRoomPage
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

  /* ------------------------------------------------------------------------ */
  /*  INITIAL LOAD PER ROOM                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let mounted = true;

    console.log('[useChatPersistence] mount / roomId changed:', roomId);

    // 🔁 IMPORTANT: clear messages immediately when roomId changes
    setIsLoading(true);
    setMessages([]);

    (async () => {
      try {
        const loaded = await loadMessages(roomId);
        if (!mounted) return;

        loaded.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setMessages(loaded);
      } catch (e) {
        console.warn(
          '[useChatPersistence] loadMessages error for roomId:',
          roomId,
          e,
        );
        setMessages([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
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

  /* ------------------------------------------------------------------------ */
  /*  SENDING HELPER (TEXT + RICH)                                            */
  /* ------------------------------------------------------------------------ */

  const sendRichMessage = useCallback(
    async (payload: Partial<ChatMessage>) => {
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
        id: createLocalId(),
        roomId,
        senderId: currentUserId,
        createdAt: now,
        fromMe: true,
        status: 'pending', // offline-first
        ...payload,        // includes conversationId, replyToId, attachments, etc.
      };

      const local = [...messages, draft];
      await persist(local);

      if (!sendOverNetwork) {
        // Backend not wired: keep as pending for now.
        return;
      }

      const sentOk = await sendOverNetwork(draft).catch((e) => {
        console.warn('[useChatPersistence] sendOverNetwork error', e);
        return false;
      });

      if (!sentOk) {
        // Stay pending; will retry in attemptFlushQueue.
        return;
      }

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

      console.log(
        '[useChatPersistence] sendTextMessage payload:',
        text.trim(),
        extra,
      );
    },
    [sendRichMessage],
  );

  /* ------------------------------------------------------------------------ */
  /*  EDIT / DELETE / REPLY                                                   */
  /* ------------------------------------------------------------------------ */

  const editMessage = useCallback(
    async (messageId: string, patch: Partial<ChatMessage>) => {
      const next: ChatMessage[] = messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              ...patch,
              isEdited: true,
              updatedAt: new Date().toISOString(),
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

  /* ------------------------------------------------------------------------ */
  /*  RETRY PENDING MESSAGES                                                  */
  /* ------------------------------------------------------------------------ */

  const attemptFlushQueue = useCallback(async () => {
    if (!sendOverNetwork) return;

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

  /* ------------------------------------------------------------------------ */
  /*  REPLACE MESSAGES (REMOTE SYNC, ETC.)                                    */
  /* ------------------------------------------------------------------------ */

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
