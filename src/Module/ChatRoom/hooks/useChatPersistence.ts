// src/screens/chat/hooks/useChatPersistence.ts

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ChatMessage, MessageStatus } from '../chatTypes';
import {
  loadMessages,
  saveMessages,
} from '../Storage/chatStorage';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

export type SendOverNetworkFn = (
  message: ChatMessage,
) => Promise<boolean>;

type UseChatPersistenceOptions = {
  roomId: string;
  currentUserId: string;
  sendOverNetwork?: SendOverNetworkFn;
};

export type UseChatPersistenceResult = {
  messages: ChatMessage[];
  isLoading: boolean;

  sendTextMessage: (
    text: string,
    extra?: Partial<ChatMessage>,
  ) => Promise<void>;

  sendRichMessage: (
    payload: Partial<ChatMessage>,
  ) => Promise<void>;

  editMessage: (
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => Promise<void>;

  softDeleteMessage: (
    messageId: string,
  ) => Promise<void>;

  replyToMessage: (
    parent: ChatMessage,
    text: string,
    extra?: Partial<ChatMessage>,
  ) => Promise<void>;

  attemptFlushQueue: () => Promise<void>;

  replaceMessages: (
    next: ChatMessage[],
  ) => Promise<void>;
};

/* ============================================================================
 * CONSTANTS & HELPERS
 * ============================================================================
 */

const STATUS_PENDING: MessageStatus = 'pending';
const STATUS_SENT: MessageStatus = 'sent';
const STATUS_FAILED: MessageStatus = 'failed';

const nowIso = () => new Date().toISOString();

const createLocalId = () =>
  `local_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

function sortMessages(
  list: ChatMessage[],
): ChatMessage[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

/**
 * Always returns a ChatMessage (never widens)
 */
function withStatus(
  msg: ChatMessage,
  status: MessageStatus,
  isLocalOnly?: boolean,
): ChatMessage {
  return {
    ...msg,
    status,
    ...(isLocalOnly !== undefined
      ? { isLocalOnly }
      : null),
  };
}

/**
 * Merge server messages with local cache
 * - Deduplicate by id OR clientId
 * - Server message wins
 */
function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();

  for (const msg of existing) {
    const key = msg.id ?? msg.clientId;
    if (key) map.set(key, msg);
  }

  for (const msg of incoming) {
    const key = msg.id ?? msg.clientId;
    if (!key) continue;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, msg);
      continue;
    }

    if (
      prev.status === STATUS_PENDING &&
      msg.status === STATUS_SENT
    ) {
      map.set(key, {
        ...prev,
        ...msg,
        fromMe: prev.fromMe,
      });
    }
  }

  return sortMessages(Array.from(map.values()));
}

/* ============================================================================
 * HOOK
 * ============================================================================
 */

export function useChatPersistence(
  options: UseChatPersistenceOptions,
): UseChatPersistenceResult {
  const {
    roomId,
    currentUserId,
    sendOverNetwork,
  } = options;

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const messagesRef = useRef<ChatMessage[]>([]);
  const roomIdRef = useRef<string>(roomId);

  /* --------------------------------------------------------------------------
   * KEEP REFS IN SYNC
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  /* --------------------------------------------------------------------------
   * INITIAL LOAD
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setMessages([]);

    (async () => {
      try {
        const loaded =
          await loadMessages(roomId);

        if (!mounted) return;

        setMessages(sortMessages(loaded ?? []));
      } catch (err) {
        console.warn(
          '[useChatPersistence] load error',
          err,
        );
        setMessages([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId]);

  /* --------------------------------------------------------------------------
   * PERSIST
   * --------------------------------------------------------------------------
   */

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      const sorted = sortMessages(next);
      setMessages(sorted);
      await saveMessages(roomId, sorted);
    },
    [roomId],
  );

  /* --------------------------------------------------------------------------
   * SEND RICH MESSAGE
   * --------------------------------------------------------------------------
   */

  const sendRichMessage = useCallback(
    async (payload: Partial<ChatMessage>) => {
      const hasContent =
        Boolean(
          payload.text?.trim() ||
            payload.voice ||
            payload.styledText ||
            payload.sticker ||
            payload.poll ||
            payload.event ||
            payload.attachments?.length ||
            payload.contacts?.length,
        );

      if (!hasContent) return;

      const draft: ChatMessage = {
        id: createLocalId(),
        clientId:
          payload.clientId ?? createLocalId(),
        roomId,
        conversationId:
          payload.conversationId ?? roomId,
        senderId: currentUserId,
        fromMe: true,
        createdAt: nowIso(),
        status: STATUS_PENDING,
        ...payload,
      };

      const optimistic = [
        ...messagesRef.current,
        draft,
      ];

      await persist(optimistic);

      if (!sendOverNetwork) return;

      const ok = await sendOverNetwork(draft).catch(
        () => false,
      );

      if (!ok) return;

      const reconciled = optimistic.map((m) =>
        m.id === draft.id
          ? withStatus(m, STATUS_SENT, false)
          : m,
      );

      await persist(reconciled);
    },
    [persist, roomId, currentUserId, sendOverNetwork],
  );

  /* --------------------------------------------------------------------------
   * SEND TEXT
   * --------------------------------------------------------------------------
   */

  const sendTextMessage = useCallback(
    async (
      text: string,
      extra?: Partial<ChatMessage>,
    ) => {
      if (!text.trim()) return;

      await sendRichMessage({
        text: text.trim(),
        kind: extra?.kind ?? 'text',
        ...extra,
      });
    },
    [sendRichMessage],
  );

  /* --------------------------------------------------------------------------
   * EDIT MESSAGE
   * --------------------------------------------------------------------------
   */

  const editMessage = useCallback(
    async (
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      const next = messagesRef.current.map((m) =>
        m.id === messageId
          ? {
              ...m,
              ...patch,
              isEdited: true,
              updatedAt: nowIso(),
              status: STATUS_PENDING,
            }
          : m,
      );

      await persist(next);
    },
    [persist],
  );

  /* --------------------------------------------------------------------------
   * SOFT DELETE
   * --------------------------------------------------------------------------
   */

  const softDeleteMessage = useCallback(
    async (messageId: string) => {
      const next = messagesRef.current.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isDeleted: true,
              text: '',
              styledText: undefined,
              voice: undefined,
              sticker: undefined,
              attachments: [],
              status: STATUS_PENDING,
            }
          : m,
      );

      await persist(next);
    },
    [persist],
  );

  /* --------------------------------------------------------------------------
   * REPLY
   * --------------------------------------------------------------------------
   */

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

  /* --------------------------------------------------------------------------
   * FLUSH QUEUE
   * --------------------------------------------------------------------------
   */

  const attemptFlushQueue = useCallback(
    async () => {
      if (!sendOverNetwork) return;

      let next = [...messagesRef.current];

      for (const msg of next) {
        if (
          msg.status !== STATUS_PENDING &&
          msg.status !== STATUS_FAILED
        ) {
          continue;
        }

        const ok = await sendOverNetwork(msg).catch(
          () => false,
        );

        next = next.map((m) =>
          m.id === msg.id
            ? withStatus(
                m,
                ok ? STATUS_SENT : STATUS_FAILED,
                !ok,
              )
            : m,
        );
      }

      await persist(next);
    },
    [persist, sendOverNetwork],
  );

  /* --------------------------------------------------------------------------
   * REPLACE MESSAGES (WS SYNC)
   * --------------------------------------------------------------------------
   */

  const replaceMessages = useCallback(
    async (next: ChatMessage[]) => {
      const merged = mergeMessages(
        messagesRef.current,
        next,
      );
      await persist(merged);
    },
    [persist],
  );

  /* --------------------------------------------------------------------------
   * API
   * --------------------------------------------------------------------------
   */

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
