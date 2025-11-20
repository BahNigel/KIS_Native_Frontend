// src/screens/chat/chatMapping.ts

import type { ChatMessage } from '../chatTypes';

// Helper to map backend payload -> ChatMessage
export const mapBackendToChatMessage = (
  payload: any,
  currentUserId: string,
  roomId: string,
): ChatMessage => {
  const createdMs =
    typeof payload.createdAt === 'number'
      ? payload.createdAt
      : Date.now();

  const text = payload.ciphertext ?? '';

  return {
    id: String(payload.id ?? payload._id ?? Date.now().toString()),
    createdAt: new Date(createdMs).toISOString(),
    roomId: String(payload.conversationId ?? roomId),
    senderId: String(payload.senderId ?? 'unknown'),
    fromMe: String(payload.senderId ?? '') === currentUserId,
    kind: 'text',
    status: 'sent',
    text,
    replyToId: payload.replyToId,
    // attachments etc can be mapped later when we fully wire them
  };
};
