// src/utils/normalizeConversation.ts

import { Chat } from './messagesUtils';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { clearCacheByKey, getCache, setCache } from '@/network/cache';

// 🔐 Cache configuration for conversations
export const CONVERSATION_CACHE_TYPE = 'CHAT_CACHE';
export const CONVERSATION_CACHE_KEY = 'CONVERSATION_LIST';

/* -------------------------------------------------------------------------- */
/*  CONSTANTS                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Per-chat cache key: maps a chat/contact → small metadata (e.g. conversation id).
 * NOTE: In this file we no longer store full conversation payloads under this key
 * to avoid duplication. The full list is stored ONLY under CONVERSATION_CACHE_KEY.
 * Other modules (e.g. ChatRoomPage) can still use this to map chat → conv id.
 */
export const conversationCacheKeyForChat = (chatId: string | number) =>
  `CHAT_CONVERSATION_${String(chatId)}`;

/**
 * Compute a safe, non-empty ID string for a conversation-like object.
 */
function computeChatId(raw: any): string {
  if (!raw) return 'unknown';

  const candidates = [
    raw.id,
    raw.conversation_id,
    raw.conversationId,
    raw.uuid,
    raw.pk,
  ];

  const firstValid = candidates.find((v) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s.length > 0 && s !== 'undefined' && s !== 'null';
  });

  if (firstValid !== undefined) return String(firstValid);

  const namePart =
    raw?.title || raw?.name || raw?.description || 'conversation';
  const timePart =
    raw?.last_message_at || raw?.lastAt || raw?.created_at || '';

  const base = `${namePart}_${timePart}`.replace(/\s+/g, '-');

  if (base && base !== 'conversation_') {
    return `local_${base}`;
  }

  return `local_${Math.random().toString(16).slice(2)}`;
}

/**
 * Normalize raw Django conversation into Chat model.
 */
export function normalizeConversation(raw: any): Chat {
  if (!raw) {
    return {
      id: 'unknown',
      name: 'Unnamed Conversation',
      lastMessage: '',
      lastAt: '',
      unreadCount: 0,
      hasMention: false,
      participants: [],
      kind: undefined,
      isGroup: false,
      isGroupChat: false,
      isCommunityChat: false,
      isContactChat: false,
      isDirect: false,
      requestState: 'none',
      requestInitiatorId: undefined,
      requestRecipientId: undefined,
    };
  }

  const id = computeChatId(raw);

  return {
    id,
    name: raw.title || raw.name || raw.description || 'Unnamed Conversation',

    lastMessage: raw.last_message_preview ?? raw.lastMessage ?? '',
    lastAt: raw.last_message_at ?? raw.lastAt ?? '',

    unreadCount: raw.unread_count ?? raw.unreadCount ?? 0,
    hasMention: raw.has_mention ?? raw.hasMention ?? false,

    participants: raw.participants ?? [],

    kind: raw.type ?? raw.kind,
    isGroup: (raw.type ?? raw.kind) === 'group',
    isGroupChat: (raw.type ?? raw.kind) === 'group',
    isCommunityChat: (raw.type ?? raw.kind) === 'community',
    isContactChat: (raw.type ?? raw.kind) === 'direct',
    isDirect: (raw.type ?? raw.kind) === 'direct',

    requestState: raw.request_state ?? raw.requestState ?? 'none',
    requestInitiatorId:
      raw.request_initiator ?? raw.requestInitiatorId ?? undefined,
    requestRecipientId:
      raw.request_recipient ?? raw.requestRecipientId ?? undefined,
  };
}

/**
 * Read cached conversation list from local storage.
 * Single source of truth: list is stored only under CONVERSATION_CACHE_KEY.
 */
async function getRawConversationsFromCache(): Promise<any[]> {
  try {
    const cached = await getCache(CONVERSATION_CACHE_TYPE, CONVERSATION_CACHE_KEY);

    if (!cached) return [];

    if (Array.isArray(cached)) return cached;

    if (Array.isArray((cached as any).results)) return cached.results;

    if (cached?.data && Array.isArray(cached.data.results)) {
      return cached.data.results;
    }

    console.warn(
      '[fetchConversationsForCurrentUser] Unexpected cache shape:',
      cached,
    );
    return [];
  } catch (e) {
    console.warn('[fetchConversationsForCurrentUser] Cache read failed:', e);
    return [];
  }
}

/**
 * AWAITED REFRESH:
 * - We fetch from backend
 * - If backend returns empty list → clear cache
 * - Otherwise we overwrite the single list cache with a de-duplicated array.
 */
async function refreshConversationsAndHandleEmpty() {
  try {
    const res = await getRequest(ROUTES.chat.listConversations, {
      errorMessage: 'Unable to load conversations.',
    });

    const rawList = Array.isArray(res?.data?.results)
      ? res.data.results
      : [];

    console.log(
      '[refreshConversationsAndHandleEmpty] Fetched conversations:',
      rawList.length,
    );

    // ── If no conversations: clear the main list cache and exit ───────────
    if (rawList.length === 0) {
      console.log(
        '[fetchConversations] Backend returned ZERO conversations → clearing local cache',
      );
      await clearCacheByKey(CONVERSATION_CACHE_TYPE, CONVERSATION_CACHE_KEY);
      return;
    }

    // ── De-duplicate by computed chat id (last one wins) ──────────────────
    const map = new Map<string, any>();
    for (const conv of rawList) {
      if (!conv) continue;
      const id = computeChatId(conv);
      map.set(id, conv);
    }
    const dedupedRawList = Array.from(map.values());

    // ── Store ONLY the deduped list under the main conversations key ──────
    await setCache(CONVERSATION_CACHE_TYPE, CONVERSATION_CACHE_KEY, dedupedRawList);

    console.log(
      '[refreshConversationsAndHandleEmpty] Cached deduped conversations list (no per-conversation payloads)',
    );
  } catch (error) {
    console.warn('[fetchConversations] Background refresh failed:', error);
  }
}

/**
 * De-duplicate conversation objects by ID → last one wins.
 */
function dedupeChats(chats: Chat[]): Chat[] {
  const map = new Map<string, Chat>();

  for (const c of chats) {
    if (!c || !c.id) continue;
    map.set(String(c.id), c);
  }

  return Array.from(map.values());
}

/**
 * Public API:
 * Always return conversations from cache (fallback if empty).
 * Backend refresh runs in background AND handles empty backend → clear cache.
 */
export async function fetchConversationsForCurrentUser(
  fallback: Chat[] = [],
): Promise<Chat[]> {
  // Fire-and-forget background refresh
  refreshConversationsAndHandleEmpty();

  const cachedRaw = await getRawConversationsFromCache();
  console.log('[fetchConversationsForCurrentUser] Cached raw list:', cachedRaw);

  const baseList = cachedRaw.length ? cachedRaw : fallback;

  const normalized = baseList.map((item: any) =>
    normalizeConversation(item),
  );

  const deduped = dedupeChats(normalized);

  return deduped;
}
