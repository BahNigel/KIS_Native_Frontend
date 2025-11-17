// src/screens/chat/chatInitialMessages.ts

import type { Chat } from './messagesUtils';
import type { ChatMessage } from './chatTypes';

// Initial demo messages (unchanged, but uses roomId/currentUserId)
export const buildInitialMessages = (
  chat: Chat | null,
  roomId: string,
  currentUserId: string,
): ChatMessage[] => {
  if (!chat) return [];

  const now = new Date();
  const minusMinutes = (m: number) => {
    const d = new Date(now.getTime() - m * 60 * 1000);
    return d.toISOString();
  };

  return [
    {
      id: '1',
      text: `Hey ${chat.name}, welcome to KIS 👋`,
      createdAt: minusMinutes(25),
      roomId,
      senderId: currentUserId,
      fromMe: true,
      kind: 'text',
      status: 'read',
    },
    {
      id: '2',
      text: 'Thanks! This looks really good.',
      createdAt: minusMinutes(22),
      roomId,
      senderId: 'chat-partner',
      fromMe: false,
      kind: 'text',
      status: 'delivered',
    },
    {
      id: '3',
      text: 'Let’s test this chat room. It should feel close to WhatsApp.',
      createdAt: minusMinutes(18),
      roomId,
      senderId: currentUserId,
      fromMe: true,
      kind: 'text',
      status: 'read',
    },
    {
      id: '4',
      text: 'Yep, bubbles, timestamps, input bar… all good 😄',
      createdAt: minusMinutes(15),
      roomId,
      senderId: 'chat-partner',
      fromMe: false,
      kind: 'text',
      status: 'delivered',
    },
  ];
};
