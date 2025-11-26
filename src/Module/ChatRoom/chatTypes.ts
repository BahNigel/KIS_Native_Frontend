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

  /**
   * Backend conversation identifier (Django / Nest / Mongo).
   * This is what the server expects as conversationId.
   */
  conversationId?: string;

  /**
   * Local storage key / UI room id.
   * This can be different from conversationId (e.g. temp rows, local-only rooms).
   */
  roomId: string;

  createdAt: string;
  updatedAt?: string;

  senderId: string;
  /**
   * Optional display name for UI (server fills it when broadcasting).
   */
  senderName?: string;
  fromMe: boolean;

  kind?: MessageKind;
  status?: MessageStatus;

  /**
   * Plain text content (used to derive ciphertext on the wire).
   */
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

  /**
   * Attachments payload coming from the backend (files, images, etc.).
   * For now it's generic; you can strongly type it later.
   */
  attachments?: any[];

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
