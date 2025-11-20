// src/screens/chat/storage/chatStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../chatTypes';

const STORAGE_KEY_PREFIX = 'KIS_CHAT_MESSAGES_BY_ROOM_V1:';

const buildKey = (roomId: string) => `${STORAGE_KEY_PREFIX}${roomId}`;

export async function loadMessages(roomId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(roomId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    // Ensure array & objects
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn('[chatStorage] loadMessages error', e);
    return [];
  }
}

export async function saveMessages(
  roomId: string,
  messages: ChatMessage[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(buildKey(roomId), JSON.stringify(messages));
  } catch (e) {
    console.warn('[chatStorage] saveMessages error', e);
  }
}

export async function upsertMessage(
  roomId: string,
  message: ChatMessage,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const index = existing.findIndex((m) => m.id === message.id);
  let next: ChatMessage[];

  if (index === -1) {
    next = [...existing, message];
  } else {
    next = [...existing];
    next[index] = { ...existing[index], ...message };
  }

  await saveMessages(roomId, next);
  return next;
}

export async function removeMessage(
  roomId: string,
  messageId: string,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const next = existing.filter((m) => m.id !== messageId);
  await saveMessages(roomId, next);
  return next;
}

export async function updateMessageStatus(
  roomId: string,
  messageId: string,
  status: ChatMessage['status'],
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const next = existing.map((m) =>
    m.id === messageId ? { ...m, status } : m,
  );
  await saveMessages(roomId, next);
  return next;
}

// Helper to mark batches as sent / delivered, etc.
export async function bulkUpdateMessages(
  roomId: string,
  updater: (message: ChatMessage) => ChatMessage,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const next = existing.map(updater);
  await saveMessages(roomId, next);
  return next;
}
