// src/screens/chat/hooks/useChatPersistence.ts

/* ============================================================================
 * OFFLINE-FIRST CHAT PERSISTENCE HOOK (TYPE-SAFE, serverId AWARE)
 * ---------------------------------------------------------------------------
 * This version FIXES all TypeScript issues reported:
 *
 * 1) SendOverNetworkResult union narrowing (serverId access safe)
 * 2) ChatMessage.id optional vs required mismatch
 * 3) string | undefined key usage
 * 4) Strict clientId / serverId identity rules
 *
 * It intentionally exceeds 500 LOC to remain explicit, debuggable,
 * and production-grade.
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ChatMessage,
  MessageStatus,
} from '../chatTypes';

import {
  loadMessages,
  saveMessages,
} from '../Storage/chatStorage';

/* ============================================================================
 * NETWORK CONTRACT TYPES (STRICT)
 * ============================================================================
 */

/**
 * Transport ACK when message is accepted by server.
 */
export type SendOverNetworkAck = {
  ok: true;
  serverId: string;
};

/**
 * Transport NACK or failure.
 */
export type SendOverNetworkNack = {
  ok: false;
};

/**
 * Discriminated union for safe narrowing.
 */
export type SendOverNetworkResult =
  | SendOverNetworkAck
  | SendOverNetworkNack;

/**
 * Transport function injected from messaging layer.
 */
export type SendOverNetworkFn = (
  message: ChatMessage,
) => Promise<SendOverNetworkResult>;

/* ============================================================================
 * HOOK OPTIONS / API
 * ============================================================================
 */

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
 * STATUS CONSTANTS
 * ============================================================================
 */

const STATUS_QUEUED: MessageStatus = 'pending';
const STATUS_SENT: MessageStatus = 'sent';
const STATUS_FAILED: MessageStatus = 'failed';

/* ============================================================================
 * ID & TIME HELPERS
 * ============================================================================
 */

const nowIso = (): string => new Date().toISOString();

/**
 * Always returns a NON-EMPTY string.
 */
const createClientId = (): string => {
  return `client_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
};

/**
 * Ensures we always have a usable identity key.
 */
const getIdentityKey = (msg: ChatMessage): string => {
  if (msg.serverId) return msg.serverId;
  return msg.clientId;
};

/* ============================================================================
 * SORTING & NORMALIZATION
 * ============================================================================
 */

function sortMessages(
  list: ChatMessage[],
): ChatMessage[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return getIdentityKey(a).localeCompare(
      getIdentityKey(b),
    );
  });
}

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

/* ============================================================================
 * MERGE / DEDUPLICATION
 * ============================================================================
 */

function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();

  for (const msg of existing) {
    map.set(getIdentityKey(msg), msg);
  }

  for (const msg of incoming) {
    const key = getIdentityKey(msg);
    const prev = map.get(key);

    if (!prev) {
      map.set(key, msg);
      continue;
    }

    if (
      prev.status === STATUS_QUEUED &&
      msg.status === STATUS_SENT
    ) {
      map.set(key, {
        ...prev,
        ...msg,
        fromMe: prev.fromMe,
      });
      continue;
    }

    if (msg.serverId) {
      map.set(key, { ...prev, ...msg });
    }
  }

  return sortMessages(Array.from(map.values()));
}

/* ============================================================================
 * MAIN HOOK
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

  /* ------------------------------------------------------------------------
   * REF SYNC
   * --------------------------------------------------------------------- */

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  /* ------------------------------------------------------------------------
   * INITIAL LOAD
   * --------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setMessages([]);

    (async () => {
      try {
        const loaded = await loadMessages(roomId);
        if (!mounted) return;
        setMessages(sortMessages(loaded ?? []));
      } catch (err) {
        console.warn('[useChatPersistence] load error', err);
        setMessages([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId]);

  /* ------------------------------------------------------------------------
   * PERSIST
   * --------------------------------------------------------------------- */

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      const sorted = sortMessages(next);
      setMessages(sorted);
      await saveMessages(roomIdRef.current, sorted);
    },
    [],
  );

  /* ------------------------------------------------------------------------
   * SEND RICH MESSAGE
   * --------------------------------------------------------------------- */

  const sendRichMessage = useCallback(
    async (payload: Partial<ChatMessage>) => {
      const hasContent = Boolean(
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

      const clientId = payload.clientId ?? createClientId();

      const draft: ChatMessage = {
        // IMPORTANT: id is REQUIRED in your ChatMessage type
        // We map it to clientId for local-only identity
        id: clientId,
        clientId,
        serverId: payload.serverId,
        roomId,
        conversationId: payload.conversationId ?? roomId,
        senderId: currentUserId,
        senderName: payload.senderName,
        fromMe: true,
        createdAt: nowIso(),
        status: STATUS_QUEUED,
        ...payload,
      };

      const optimistic = [
        ...messagesRef.current,
        draft,
      ];

      await persist(optimistic);

      if (!sendOverNetwork) return;

      const result = await sendOverNetwork(draft).catch(
        () => ({ ok: false } as SendOverNetworkNack),
      );

      if (!result.ok) return;

      const reconciled = optimistic.map((m) =>
        m.clientId === clientId
          ? {
              ...m,
              serverId: result.serverId,
              status: STATUS_SENT,
              isLocalOnly: false,
            }
          : m,
      );

      await persist(reconciled);
    },
    [persist, roomId, currentUserId, sendOverNetwork],
  );

  /* ------------------------------------------------------------------------
   * SEND TEXT
   * --------------------------------------------------------------------- */

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

  /* ------------------------------------------------------------------------
   * EDIT MESSAGE
   * --------------------------------------------------------------------- */

  const editMessage = useCallback(
    async (
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      const next = messagesRef.current.map((m) =>
        getIdentityKey(m) === messageId
          ? {
              ...m,
              ...patch,
              isEdited: true,
              updatedAt: nowIso(),
              status: STATUS_QUEUED,
            }
          : m,
      );

      await persist(next);
    },
    [persist],
  );

  /* ------------------------------------------------------------------------
   * SOFT DELETE
   * --------------------------------------------------------------------- */

  const softDeleteMessage = useCallback(
    async (messageId: string) => {
      const next = messagesRef.current.map((m) =>
        getIdentityKey(m) === messageId
          ? {
              ...m,
              isDeleted: true,
              text: '',
              styledText: undefined,
              voice: undefined,
              sticker: undefined,
              attachments: [],
              status: STATUS_QUEUED,
            }
          : m,
      );

      await persist(next);
    },
    [persist],
  );

  /* ------------------------------------------------------------------------
   * REPLY
   * --------------------------------------------------------------------- */

  const replyToMessage = useCallback(
    async (
      parent: ChatMessage,
      text: string,
      extra?: Partial<ChatMessage>,
    ) => {
      await sendTextMessage(text, {
        ...extra,
        replyToId: parent.serverId ?? parent.clientId,
      });
    },
    [sendTextMessage],
  );

  /* ------------------------------------------------------------------------
   * FLUSH QUEUE
   * --------------------------------------------------------------------- */

  const attemptFlushQueue = useCallback(
    async () => {
      if (!sendOverNetwork) return;

      let next = [...messagesRef.current];

      for (const msg of next) {
        if (
          msg.status !== STATUS_QUEUED &&
          msg.status !== STATUS_FAILED
        ) {
          continue;
        }

        const result = await sendOverNetwork(msg).catch(
          () => ({ ok: false } as SendOverNetworkNack),
        );

        next = next.map((m) =>
          m.clientId === msg.clientId
            ? {
                ...m,
                status: result.ok
                  ? STATUS_SENT
                  : STATUS_FAILED,
                serverId:
                  result.ok
                    ? result.serverId
                    : m.serverId,
                isLocalOnly: !result.ok,
              }
            : m,
        );
      }

      await persist(next);
    },
    [persist, sendOverNetwork],
  );

  /* ------------------------------------------------------------------------
   * MERGE WS MESSAGES
   * --------------------------------------------------------------------- */

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

  /* ------------------------------------------------------------------------
   * API
   * --------------------------------------------------------------------- */

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
