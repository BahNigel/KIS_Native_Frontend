import type { Chat } from './messagesUtils';

/**
 * Message kind must match backend enum:
 * 'text' | 'voice' | 'styled_text' | 'sticker' | 'contacts' | 'poll' | 'event' | 'system'
 * Media/files are represented via attachments, not kind.
 */
export type MessageKind =
  | 'text'
  | 'voice'
  | 'styled_text'
  | 'sticker'
  | 'system'
  | 'contacts'
  | 'poll'
  | 'event';

export type MessageStatus =
  | 'local_only'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/**
 * Kind of attachment file (frontend side).
 * Backend also has AttachmentKind; keep in sync if needed.
 */
export type AttachmentKindType =
  | 'image'
  | 'video'
  | 'file'
  | 'audio'
  | 'voice'
  | 'other';

/**
 * Attachment payload coming from / going to backend.
 * Mirrors the Mongoose schema for `attachments`.
 */
export type ChatAttachment = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;

  kind?: AttachmentKindType | string;

  width?: number;
  height?: number;
  durationMs?: number;
  thumbUrl?: string;
};

/**
 * Contact card(s) shared in a message.
 * These are built from real user contacts (name + phone).
 */
export type ContactAttachment = {
  id: string;
  name: string;
  phone: string; // used for sending / rendering
};

/**
 * Poll option + votes.
 */
export type PollOption = {
  id: string;
  text: string;
  votes?: number;
};

/**
 * Poll content stored in a message.
 */
export type PollMessage = {
  id?: string;
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  expiresAt?: string | null;
};

/**
 * Event content stored in a message.
 */
export type EventMessage = {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string; // ISO datetime
  endsAt?: string;  // ISO datetime
};

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

  /**
   * Client-generated identifier used for dedupe and ACK correlation.
   * This should match the clientId you send to the backend.
   */
  clientId?: string;

  createdAt: string;
  updatedAt?: string;

  senderId: string;

  /**
   * Marked true by the backend for the very first message in the conversation.
   * Used by DM-request UX (initiator vs recipient banners, lock state).
   */
  isFirstMessage?: boolean;

  /**
   * Optional display name for UI (server fills it when broadcasting / in history).
   */
  senderName?: string;

  fromMe: boolean;

  kind?: MessageKind;
  status?: MessageStatus;

  /**
   * Plain text content (used to derive ciphertext on the wire).
   * Backend field name is `ciphertext`, but frontend uses `text`.
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
   * Matches MessageEntity.attachments.
   */
  attachments?: ChatAttachment[];

  /**
   * Contact cards shared in this message (kind === 'contacts').
   */
  contacts?: ContactAttachment[];

  /**
   * Poll content (kind === 'poll').
   */
  poll?: PollMessage;

  /**
   * Event content (kind === 'event').
   */
  event?: EventMessage;

  replyToId?: string;

  isEdited?: boolean;
  isDeleted?: boolean;
  isLocalOnly?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;

  reactions?: Record<string, string[]>;
};

/**
 * Minimal sub-room type for now.
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
