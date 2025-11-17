// src/screens/chat/chatTypes.ts

import type { Chat } from './messagesUtils';

export type MessageKind =
  | 'text'
  | 'styled_text'
  | 'voice'
  | 'image'
  | 'video'
  | 'file'
  | 'sticker'
  | 'system';

export type MessageStatus =
  | 'local_only'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type ChatMessage = {
  id: string;
  createdAt: string;
  updatedAt?: string;

  roomId: string;
  senderId: string;
  fromMe: boolean;

  kind?: MessageKind;
  status?: MessageStatus;

  text?: string;

  voice?: {
    uri: string;
    durationMs: number;
  };

  styledText?: {
    text: string;
    backgroundColor: string;
    fontSize: number;
    fontColor: string;
    fontFamily?: string;
  };

  sticker?: {
    id: string;
    uri: string;
    text?: string;
    width?: number;
    height?: number;
  };

  replyToId?: string;

  isEdited?: boolean;
  isDeleted?: boolean;
  isLocalOnly?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;

  reactions?: Record<string, string[]>;
};

/**
 * Minimal sub-room type for now (will be refined when we wire backend + store).
 * This supports the header count + sheets.
 */
export type SubRoom = {
  id: string;
  parentRoomId: string;
  rootMessageId?: string;
  title?: string;
};

export type ChatRoomPageProps = {
  chat: Chat | null;
  onBack: () => void;

  // For forwarding
  allChats?: Chat[];
  onForwardMessages?: (params: {
    fromRoomId: string;
    toChatIds: string[];
    messages: ChatMessage[];
  }) => void;
};
