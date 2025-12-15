// src/screens/chat/ChatRoomHandlers.ts

import { Alert } from 'react-native';
import {
  uploadFileToBackend,
  AttachmentMeta,
} from './uploadFileToBackend';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';

import type { ChatMessage } from './chatTypes';

import type {
  AttachmentFilePayload,
  FilesType,
} from './ChatRoomPage';

import { SimpleContact } from './componets/main/ForAttachments/ContactsModal';
import { PollDraft } from './componets/main/ForAttachments/PollModal';
import { EventDraft } from './componets/main/ForAttachments/EventModal';
import { Sticker } from './componets/main/FroSticker/StickerEditor';
import { TextCardPayload } from './componets/main/TextCardComposer';

/* =========================================================
   SHARED TYPES
========================================================= */

type EnsureConversationId = (
  preview: string,
) => Promise<string | null>;

type SendRichMessage = (payload: any) => Promise<void>;
type SendTextMessage = (text: string, meta: any) => Promise<void>;

/* =========================================================
   SEND TEXT / EDIT / REPLY
========================================================= */

export const handleSend = async ({
  draft,
  chat,
  editing,
  replyTo,
  currentUserId,
  draftKey,
  dmRole,
  ensureConversationId,
  editMessage,
  replyToMessage,
  sendTextMessage,
  setDraft,
  setDraftsByKey,
  setEditing,
  setReplyTo,
  setHasLocallyAcceptedRequest,
}: {
  draft: string;
  chat: any;
  editing: ChatMessage | null;
  replyTo: ChatMessage | null;
  currentUserId: string;
  draftKey: string;
  dmRole: 'initiator' | 'recipient' | null;
  ensureConversationId: EnsureConversationId;
  editMessage: Function;
  replyToMessage: Function;
  sendTextMessage: SendTextMessage;
  setDraft: (v: string) => void;
  setDraftsByKey: Function;
  setEditing: (v: ChatMessage | null) => void;
  setReplyTo: (v: ChatMessage | null) => void;
  setHasLocallyAcceptedRequest: (v: boolean) => void;
}) => {
   console.log("I am chcking for messagein here: ", chat)
  const text = draft.trim();
  if (!text || !chat) return;
  
 console.log("I am chcking for messagein here 333: ", chat)
  const convId = await ensureConversationId(text);
  if (!convId) return;
console.log("I am chcking for messagein here 4444: ", chat)
  if (editing) {
    await editMessage(editing.id, {
      text,
      isEdited: true,
      status: 'pending',
      conversationId: convId,
    });
    setEditing(null);
  } else if (replyTo) {
    await replyToMessage(replyTo, text, {
      kind: 'text',
      fromMe: true,
      senderId: currentUserId,
      conversationId: convId,
    });
    setReplyTo(null);

    if (dmRole === 'recipient') {
      setHasLocallyAcceptedRequest(true);
    }
  } else {

    console.log("I am chcking for messagein here 55555: ", chat)

    await sendTextMessage(text, {
      kind: 'text',
      fromMe: true,
      senderId: currentUserId,
      conversationId: convId,
    });
  }

  console.log("I am chcking for messagein here 666: ", chat)

  setDraft('');
  setDraftsByKey((prev: any) => ({
    ...prev,
    [draftKey]: '',
  }));
};

/* =========================================================
   CUSTOM / STYLED TEXT (TEXT CARD)
========================================================= */

export const handleSendStyledText = async ({
  payload,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
  setTextCardBg,
}: {
  payload: TextCardPayload;
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
  setTextCardBg: (v: string | null) => void;
}) => {
  if (!chat) return;

  const preview = payload.text || 'Styled message';
  const convId = await ensureConversationId(preview);
  if (!convId) return;

  await sendRichMessage({
    kind: 'styled_text',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    styledText: {
      text: payload.text,
      backgroundColor: payload.backgroundColor,
      fontColor: payload.fontColor,
      fontSize: payload.fontSize,
      fontFamily: payload.fontFamily,
    },
  });

  setTextCardBg(null);
};

/* =========================================================
   VOICE
========================================================= */

export const handleSendVoice = async ({
  uri,
  durationMs,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  uri: string;
  durationMs: number;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !authToken) return;

  const convId = await ensureConversationId('Voice message');
  if (!convId) return;

  let attachment: AttachmentMeta | null = null;

  try {
    attachment = await uploadFileToBackend({
      file: {
        uri,
        name: uri.split('/').pop() || `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      },
      authToken,
      baseUrl: NEST_API_BASE_URL,
    });
  } catch {}

  await sendRichMessage({
    kind: 'voice',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    voice: {
      uri: attachment?.url ?? uri,
      durationMs,
    },
    attachments: attachment ? [attachment] : [],
  });
};

/* =========================================================
   STICKER
========================================================= */

export const handleSendSticker = async ({
  sticker,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  sticker: Sticker;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !authToken) return;

  const convId = await ensureConversationId('Sticker');
  if (!convId) return;

  let attachment: AttachmentMeta | null = null;

  try {
    attachment = await uploadFileToBackend({
      file: {
        uri: sticker.uri,
        name: `${sticker.id}.png`,
        type: 'image/png',
      },
      authToken,
      baseUrl: NEST_API_BASE_URL,
    });
  } catch {}

  await sendRichMessage({
    kind: 'sticker',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    sticker: {
      id: sticker.id,
      uri: attachment?.url ?? sticker.uri,
      text: sticker.text,
    },
    attachments: attachment ? [attachment] : [],
  });
};

/* =========================================================
   ATTACHMENTS
========================================================= */

export const handleSendAttachment = async ({
  input,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  input: AttachmentFilePayload;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !authToken) return;

  const caption = (input?.caption ?? '').trim();
  const files = input.files ?? [];

  const convId = await ensureConversationId(caption || 'File');
  if (!convId) return;

  const uploaded = await Promise.all(
    files.map(async (file: FilesType) => {
      try {
        return await uploadFileToBackend({
          file,
          authToken,
          baseUrl: NEST_API_BASE_URL,
        });
      } catch {
        return null;
      }
    }),
  );

  const attachments = uploaded.filter(Boolean);

  if (!attachments.length && !caption) return;

  await sendRichMessage({
    kind: 'text',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    text: caption || undefined,
    attachments,
  });
};

/* =========================================================
   CONTACTS / POLL / EVENT
========================================================= */

export const handleSendContacts = async ({
  contacts,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  contacts: SimpleContact[];
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !contacts.length) return;

  const convId = await ensureConversationId(
    `Contact: ${contacts[0].name}`,
  );
  if (!convId) return;

  await sendRichMessage({
    kind: 'contacts',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    contacts,
  });
};

export const handleCreatePoll = async ({
  poll,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  poll: PollDraft;
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat) return;

  const convId = await ensureConversationId(poll.question || 'Poll');
  if (!convId) return;

  await sendRichMessage({
    kind: 'poll',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    poll,
  });
};

export const handleCreateEvent = async ({
  event,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  event: EventDraft;
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat) return;

  const convId = await ensureConversationId(event.title || 'Event');
  if (!convId) return;

  await sendRichMessage({
    kind: 'event',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    event,
  });
};

/* =========================================================
   REQUEST ACTIONS
========================================================= */

export const handleAcceptRequest = async ({
  chat,
  currentUserId,
  ensureConversationId,
  sendTextMessage,
  setHasLocallyAcceptedRequest,
}: {
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendTextMessage: SendTextMessage;
  setHasLocallyAcceptedRequest: (v: boolean) => void;
}) => {
  if (!chat) return;

  const convId = await ensureConversationId('Accept chat request');
  if (!convId) return;

  await sendTextMessage('Accepted chat request', {
    kind: 'text',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
  });

  setHasLocallyAcceptedRequest(true);
};

export const handleBlockRequest = async (chatId?: string) => {
  if (!chatId) return;

  const url = `${ROUTES.chat.listConversations}${chatId}/block_chat/`;
  await getRequest(url);
};

export const handleArchiveRequest = () => {
  Alert.alert(
    'Archive chat',
    'Archiving is not wired to backend yet.',
  );
};
