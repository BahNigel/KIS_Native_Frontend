// src/screens/chat/ChatRoomPage.tsx
/* eslint-disable react-hooks/exhaustive-deps */

/**
 * ChatRoomPage
 * -----------------------------------------------------------------------------
 * This screen is the orchestration layer for:
 * - Message rendering
 * - Draft management
 * - Selection / bulk actions
 * - DM lock rules
 * - Attachment & rich message dispatch
 * - Socket-backed optimistic messaging
 *
 * IMPORTANT:
 * - Business logic lives in hooks + handlers
 * - This page ONLY coordinates state & UI
 * - Socket lifecycle is abstracted away
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '../../theme/useTheme';
import { chatRoomStyles as styles } from './chatRoomStyles';

/* -------------------------------------------------------------------------- */
/*                                   UI PARTS                                 */
/* -------------------------------------------------------------------------- */

import { ChatHeader } from './componets/main/ChatHeader';
import { MessageList } from './componets/main/MessageList';
import { MessageComposer } from './componets/main/MessageComposer';

import {
  TextCardComposer,
  TextCardPayload,
} from './componets/main/TextCardComposer';

import {
  StickerEditor,
  Sticker,
} from './componets/main/FroSticker/StickerEditor';

import { ForwardChatSheet } from './componets/main/ForwardChatSheet';
import { PinnedMessagesSheet } from './componets/main/PinnedMessagesSheet';
import { SubRoomsSheet } from './componets/main/SubRoomsSheet';

/* -------------------------------------------------------------------------- */
/*                                   HOOKS                                    */
/* -------------------------------------------------------------------------- */

import { useChatAuth } from './hooks/useChatAuth';
import { useConversationBootstrap } from './hooks/useConversationBootstrap';
import { useDraftState } from './hooks/useDraftState';
import { useChatMessaging } from './hooks/useChatMessaging';
import { useSelectionState } from './hooks/useSelectionState';
import { useBulkMessageActions } from './hooks/useBulkMessageActions';
import { useSocket } from '../../../SocketProvider';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

import type {
  ChatMessage,
  ChatRoomPageProps,
  SubRoom,
} from './chatTypes';
import { participantsToIds } from './messagesUtils';

/* -------------------------------------------------------------------------- */
/*                        ATTACHMENTS / RICH PAYLOADS                          */
/* -------------------------------------------------------------------------- */

import { SimpleContact } from './componets/main/ForAttachments/ContactsModal';
import { PollDraft } from './componets/main/ForAttachments/PollModal';
import { EventDraft } from './componets/main/ForAttachments/EventModal';

/* -------------------------------------------------------------------------- */
/*                               CENTRAL HANDLERS                              */
/* -------------------------------------------------------------------------- */

import * as Handlers from './ChatRoomHandlers';

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export type FilesType = {
  uri: string;
  name: string;
  type: string | null;
  size?: number | null;
};

export type AttachmentFilePayload = {
  files?: FilesType[];
  caption?: string;
};

type ExtendedChatRoomPageProps = ChatRoomPageProps & {
  hideHeader?: boolean;
};

type MessageLocator = {
  scrollToMessage: (messageId: string) => void;
  highlightMessage: (messageId: string) => void;
};

/* ========================================================================== */
/*                                MAIN COMPONENT                              */
/* ========================================================================== */

export const ChatRoomPage: React.FC<ExtendedChatRoomPageProps> = ({
  chat,
  onBack,
  allChats = [],
  onForwardMessages,
  hideHeader,
}) => {
  /* ------------------------------------------------------------------------ */
  /*                               THEME / SAFE AREA                           */
  /* ------------------------------------------------------------------------ */

  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  /* ------------------------------------------------------------------------ */
  /*                               AUTH CONTEXT                                */
  /* ------------------------------------------------------------------------ */

  const { authToken, currentUserId, currentUserName } =
    useChatAuth(chat);
  const { typingByConversation, presenceByUser } = useSocket();

  /* ------------------------------------------------------------------------ */
  /*                         CONVERSATION BOOTSTRAP                            */
  /* ------------------------------------------------------------------------ */

  const {
    isDirectChat,
    conversationId,
    storageRoomId,
    ensureConversationId,
  } = useConversationBootstrap(chat, authToken);

  /* ------------------------------------------------------------------------ */
  /*                                DRAFT STATE                                */
  /* ------------------------------------------------------------------------ */

  const {
    draft,
    setDraft,
    draftKey,
    setDraftsByKey,
    handleChangeDraft,
  } = useDraftState(conversationId, chat?.id);

  /* ------------------------------------------------------------------------ */
  /*                          MESSAGING (SOCKET-BACKED)                        */
  /* ------------------------------------------------------------------------ */

  const {
    messages,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    sendTyping,
    sendReaction,
    retryMessage,
  } = useChatMessaging({
    chat,
    storageRoomId,
    currentUserId,
    currentUserName,
    conversationId,
  });

  /* ======================================================================== */
  /*                              LOCAL UI STATE                               */
  /* ======================================================================== */

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const noop = () => {};

  const [openStickerEditor, setOpenStickerEditor] = useState(false);
  const [textCardBg, setTextCardBg] = useState<string | null>(null);
  const [stickerLibraryVersion, setStickerLibraryVersion] =
    useState(0);

  const [forwardSheetVisible, setForwardSheetVisible] =
    useState(false);
  const [pinnedSheetVisible, setPinnedSheetVisible] =
    useState(false);
  const [subRoomsSheetVisible, setSubRoomsSheetVisible] =
    useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [subRooms, setSubRooms] = useState<SubRoom[]>([]);
  const [messageLocator, setMessageLocator] =
    useState<MessageLocator | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lockOverride, setLockOverride] = useState<boolean | null>(null);
  const [muteOverride, setMuteOverride] = useState<boolean | null>(null);
  const [requestStateOverride, setRequestStateOverride] = useState<string | null>(null);
  const [groupAction, setGroupAction] = useState<'add' | 'remove' | 'role' | null>(null);
  const [groupUserIdInput, setGroupUserIdInput] = useState('');
  const [groupRoleInput, setGroupRoleInput] = useState('member');

  const handleReactMessage = useCallback(
    (message: ChatMessage, emoji: string) => {
      const fallbackId =
        message.id && message.id.startsWith('client_')
          ? null
          : message.id;
      const messageId = message.serverId ?? fallbackId;
      const convId =
        message.conversationId ?? conversationId ?? chat?.id ?? null;
      if (!messageId || !convId) return;
      sendReaction(messageId, emoji, convId);
    },
    [sendReaction, conversationId, chat?.id],
  );

  /* ======================================================================== */
  /*                              SELECTION MODE                               */
  /* ======================================================================== */

  const {
    selectionMode,
    selectedIds,
    enterSelectionMode,
    toggleSelectMessage,
    exitSelectionMode,
    selectedMessages,
    isSingleSelection,
    pinnedMessages,
    pinnedCount,
    subRoomCount,
  } = useSelectionState(messages, subRooms);

  const {
    handlePinSelected,
    handleDeleteSelected,
    handleCopySelected,
    handleMoreSelected,
    handleContinueInSubRoom,
  } = useBulkMessageActions({
    selectedIds,
    selectedMessages,
    messages,
    editMessage,
    softDeleteMessage,
    exitSelectionMode,
    isSingleSelection,
    onReportMessage: (message) => {
      const convId =
        message.conversationId ?? conversationId ?? chat?.id ?? null;
      const messageId =
        message.serverId ??
        (message.id && message.id.startsWith('client_') ? null : message.id);
      if (!convId || !messageId) return;
      Handlers.handleReportMessage({
        conversationId: String(convId),
        messageId: String(messageId),
        reason: 'user_reported',
      });
    },
    onPinMessage: (message, pinned) => {
      const convId =
        message.conversationId ?? conversationId ?? chat?.id ?? null;
      const messageId =
        message.serverId ??
        (message.id && message.id.startsWith('client_') ? null : message.id);
      if (!convId || !messageId) return;
      Handlers.handleSetPinned({
        conversationId: String(convId),
        messageId: String(messageId),
        pinned,
      });
    },
    onContinueInSubRoom: (message) => {
      const rootId = message.serverId ?? message.id;
      if (!rootId) return;
      const title =
        message.text ||
        message.styledText?.text ||
        (message.sticker ? 'Sticker' : '') ||
        (message.voice ? 'Voice message' : '') ||
        'Sub-room';
      setSubRooms((prev) => [
        ...prev,
        {
          id: `sub_${rootId}`,
          parentRoomId: String(storageRoomId),
          rootMessageId: rootId,
          title,
        },
      ]);
      setSubRoomsSheetVisible(true);
    },
  });

  /* ======================================================================== */
  /*                                 DM LOCK                                   */
  /* ======================================================================== */

  const { dmRole } = useMemo(() => {
    if (!isDirectChat || !conversationId) {
      return { dmRole: null };
    }

    const first =
      messages.find((m) => m.isFirstMessage) ??
      messages[0] ??
      null;

    let role: 'initiator' | 'recipient' | null = null;

    if ((chat as any)?.request_initiator?.id === currentUserId)
      role = 'initiator';
    else if (
      (chat as any)?.request_recipient?.id === currentUserId
    )
      role = 'recipient';
    else if (first)
      role =
        first.senderId === currentUserId
          ? 'initiator'
          : 'recipient';

    return { dmRole: role };
  }, [chat, conversationId, isDirectChat, messages, currentUserId]);

  const { dmStatusLabel, dmStatusVariant } = useMemo(() => {
    const isArchived = Boolean((chat as any)?.isArchived);
    const isLocked = lockOverride ?? Boolean((chat as any)?.isLocked);
    const requestState = String(
      requestStateOverride ?? (chat as any)?.requestState ?? 'none',
    );

    if (isArchived) {
      return { dmStatusLabel: 'Archived', dmStatusVariant: 'locked' as const };
    }

    if (isLocked) {
      return { dmStatusLabel: 'Chat locked', dmStatusVariant: 'locked' as const };
    }

    if (requestState === 'pending') {
      const label =
        dmRole === 'initiator'
          ? 'Waiting for acceptance'
          : 'Request pending';
      return { dmStatusLabel: label, dmStatusVariant: 'pending' as const };
    }

    if (requestState === 'rejected') {
      return { dmStatusLabel: 'Request rejected', dmStatusVariant: 'rejected' as const };
    }

    return { dmStatusLabel: null, dmStatusVariant: 'normal' as const };
  }, [chat, dmRole, lockOverride, requestStateOverride]);

  const currentMembership = useMemo(() => {
    const participants = (chat as any)?.participants;
    if (!Array.isArray(participants) || !currentUserId) return null;
    return (
      participants.find(
        (p: any) =>
          p?.user?.id === currentUserId ||
          p?.user === currentUserId ||
          p?.id === currentUserId,
      ) ?? null
    );
  }, [chat, currentUserId]);

  const isMuted =
    muteOverride ??
    Boolean(currentMembership?.is_muted ?? currentMembership?.isMuted);

  const isLocked = lockOverride ?? Boolean((chat as any)?.isLocked);
  const requestStateEffective = String(
    requestStateOverride ?? (chat as any)?.requestState ?? 'none',
  );

  const canSend = draft.trim().length > 0;

  const statusText = useMemo(() => {
    const convId = conversationId ?? String(storageRoomId);
    if (!convId) return 'offline';
    const typingUsers = typingByConversation?.[convId] ?? {};
    const otherTyping = Object.keys(typingUsers).filter((u) => u !== currentUserId);
    if (otherTyping.length > 0) return 'typing...';

    const participantIds = participantsToIds(chat?.participants ?? []);
    const otherIds = participantIds.filter((u) => u && u !== currentUserId);
    const anyOnline = otherIds.some((u) => presenceByUser?.[u]?.isOnline);
    if (anyOnline) return 'online';

    if ((chat as any)?.isDirect && otherIds.length > 0) {
      const lastSeenAt = otherIds
        .map((u) => presenceByUser?.[u]?.at)
        .filter((v) => typeof v === 'number')
        .sort()
        .slice(-1)[0];
      if (lastSeenAt) {
        const dt = new Date(lastSeenAt);
        const now = new Date();
        const isSameDay =
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate();
        const label = isSameDay
          ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : dt.toLocaleDateString();
        return `last seen ${label}`;
      }
    }

    return 'offline';
  }, [typingByConversation, presenceByUser, conversationId, storageRoomId, chat, currentUserId]);

  useEffect(() => {
    if (!conversationId) return;
    const isTyping = draft.trim().length > 0;
    sendTyping(isTyping);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [draft, conversationId, sendTyping]);

  /* ======================================================================== */
  /*                              HANDLER BINDINGS                             */
  /* ======================================================================== */

  const handleSend = () =>
    Handlers.handleSend({
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
      setHasLocallyAcceptedRequest: noop,
    });

  const handleToggleMute = async () => {
    const convId = conversationId ?? chat?.id;
    if (!convId) return;
    const next = !isMuted;
    await Handlers.handleMuteConversation({
      conversationId: String(convId),
      muted: next,
    });
    setMuteOverride(next);
  };

  const handleBlockChat = async () => {
    const convId = conversationId ?? chat?.id;
    if (!convId) return;
    await Handlers.handleBlockRequest(String(convId));
    setLockOverride(true);
  };

  const handleAcceptRequest = async () => {
    const convId = conversationId ?? chat?.id;
    if (!convId) return;
    await Handlers.handleAcceptConversationRequest(String(convId));
    setRequestStateOverride('accepted');
    Alert.alert('Request accepted', 'You can now chat freely.');
  };

  const handleGroupActionSubmit = async () => {
    const convId = conversationId ?? chat?.id;
    const userId = groupUserIdInput.trim();
    if (!convId || !userId || !groupAction) return;

    if (groupAction === 'add') {
      await Handlers.handleAddGroupMember({
        conversationId: String(convId),
        userId,
        baseRole: groupRoleInput.trim() || 'member',
      });
    }

    if (groupAction === 'remove') {
      await Handlers.handleRemoveGroupMember({
        conversationId: String(convId),
        userId,
      });
    }

    if (groupAction === 'role') {
      await Handlers.handleSetGroupMemberRole({
        conversationId: String(convId),
        userId,
        baseRole: groupRoleInput.trim() || 'member',
      });
    }

    setGroupAction(null);
    setGroupUserIdInput('');
  };

  const handleSendVoice = (p: { uri: string; durationMs: number }) =>
    Handlers.handleSendVoice({
      ...p,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendSticker = (sticker: Sticker) =>
    Handlers.handleSendSticker({
      sticker,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendAttachment = (input: AttachmentFilePayload) =>
    Handlers.handleSendAttachment({
      input,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendContacts = (contacts: SimpleContact[]) =>
    Handlers.handleSendContacts({
      contacts,
      chat,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleCreatePoll = (poll: PollDraft) =>
    Handlers.handleCreatePoll({
      poll,
      chat,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleCreateEvent = (event: EventDraft) =>
    Handlers.handleCreateEvent({
      event,
      chat,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  /* ======================================================================== */
  /*                                   RENDER                                  */
  /* ======================================================================== */

  const bg = palette.chatBg ?? palette.bg;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: bg, paddingTop: insets.top },
      ]}
    >
      {!hideHeader && (
        <ChatHeader
          chat={chat}
          onBack={selectionMode ? exitSelectionMode : onBack}
          palette={palette}
          statusText={statusText}
          dmStatusLabel={dmStatusLabel}
          dmStatusVariant={dmStatusVariant}
          selectionMode={selectionMode}
          selectedCount={selectedIds.length}
          onCancelSelection={exitSelectionMode}
          onPinSelected={handlePinSelected}
          onDeleteSelected={handleDeleteSelected}
          onForwardSelected={() => setForwardSheetVisible(true)}
          onCopySelected={handleCopySelected}
          onMoreSelected={selectionMode ? handleMoreSelected : () => setMenuVisible(true)}
          pinnedCount={pinnedCount}
          subRoomCount={subRoomCount}
          onOpenPinned={() => setPinnedSheetVisible(true)}
          onOpenSubRooms={() => setSubRoomsSheetVisible(true)}
          isSingleSelection={isSingleSelection}
          onContinueInSubRoom={handleContinueInSubRoom}
        />
      )}

      {!selectionMode && (
        <View
          pointerEvents={menuVisible ? 'auto' : 'none'}
          style={localStyles.menuRoot}
        >
          {menuVisible && (
            <>
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={localStyles.menuOverlay}
              />
              <View
                style={[
                  localStyles.menuBox,
                  {
                    borderColor: palette.inputBorder ?? palette.divider,
                    backgroundColor: palette.card ?? palette.surface,
                  },
                ]}
              >
                {dmRole === 'recipient' &&
                  requestStateEffective === 'pending' && (
                    <Pressable
                      onPress={async () => {
                        setMenuVisible(false);
                        await handleAcceptRequest();
                      }}
                      style={({ pressed }) => [
                        localStyles.menuItem,
                        { backgroundColor: pressed ? palette.surface : 'transparent' },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 14 }}>
                        Accept request
                      </Text>
                    </Pressable>
                  )}

                {!isLocked && (
                  <Pressable
                    onPress={async () => {
                      setMenuVisible(false);
                      await handleBlockChat();
                    }}
                    style={({ pressed }) => [
                      localStyles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      Block chat
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={async () => {
                    setMenuVisible(false);
                    await handleToggleMute();
                  }}
                  style={({ pressed }) => [
                    localStyles.menuItem,
                    { backgroundColor: pressed ? palette.surface : 'transparent' },
                  ]}
                >
                  <Text style={{ color: palette.text, fontSize: 14 }}>
                    {isMuted ? 'Unmute notifications' : 'Mute notifications'}
                  </Text>
                </Pressable>

                {(chat as any)?.isGroup && (
                  <Pressable
                    onPress={() => {
                      setMenuVisible(false);
                      setGroupRoleInput('member');
                      setGroupAction('add');
                    }}
                    style={({ pressed }) => [
                      localStyles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      Add member
                    </Text>
                  </Pressable>
                )}

                {(chat as any)?.isGroup && (
                  <Pressable
                    onPress={() => {
                      setMenuVisible(false);
                      setGroupAction('remove');
                    }}
                    style={({ pressed }) => [
                      localStyles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      Remove member
                    </Text>
                  </Pressable>
                )}

                {(chat as any)?.isGroup && (
                  <Pressable
                    onPress={() => {
                      setMenuVisible(false);
                      setGroupRoleInput('admin');
                      setGroupAction('role');
                    }}
                    style={({ pressed }) => [
                      localStyles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      Set member role
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => {
                    setMenuVisible(false);
                    Handlers.handleArchiveRequest();
                  }}
                  style={({ pressed }) => [
                    localStyles.menuItem,
                    { backgroundColor: pressed ? palette.surface : 'transparent' },
                  ]}
                >
                  <Text style={{ color: palette.text, fontSize: 14 }}>
                    Archive chat
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={groupAction != null}
        onRequestClose={() => setGroupAction(null)}
      >
        <Pressable
          style={[
            localStyles.modalOverlay,
            { backgroundColor: 'rgba(0,0,0,0.35)' },
          ]}
          onPress={() => setGroupAction(null)}
        >
          <View
            style={[
              localStyles.modalCard,
              { backgroundColor: palette.card ?? palette.surface },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[localStyles.modalTitle, { color: palette.text }]}>
              {groupAction === 'add'
                ? 'Add member'
                : groupAction === 'remove'
                ? 'Remove member'
                : 'Set member role'}
            </Text>

            <TextInput
              value={groupUserIdInput}
              onChangeText={setGroupUserIdInput}
              placeholder="User ID"
              placeholderTextColor={palette.subtext}
              style={[
                localStyles.modalInput,
                { color: palette.text, borderColor: palette.inputBorder },
              ]}
              autoCapitalize="none"
            />

            {groupAction !== 'remove' && (
              <TextInput
                value={groupRoleInput}
                onChangeText={setGroupRoleInput}
                placeholder="Role (member/admin/owner)"
                placeholderTextColor={palette.subtext}
                style={[
                  localStyles.modalInput,
                  { color: palette.text, borderColor: palette.inputBorder },
                ]}
                autoCapitalize="none"
              />
            )}

            <View style={localStyles.modalActions}>
              <Pressable
                onPress={() => setGroupAction(null)}
                style={[
                  localStyles.modalButton,
                  { borderColor: palette.inputBorder },
                ]}
              >
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleGroupActionSubmit}
                style={[
                  localStyles.modalButton,
                  { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
              >
                <Text style={{ color: palette.onPrimary ?? '#fff' }}>
                  Confirm
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <MessageList
          messages={messages}
          palette={palette}
          isEmpty={!chat}
          currentUserId={currentUserId}
          selectionMode={selectionMode}
          selectedMessageIds={selectedIds}
          onReplyToMessage={setReplyTo}
          onEditMessage={setEditing}
          onPressMessage={toggleSelectMessage}
          onLongPressMessage={enterSelectionMode}
          onReactMessage={handleReactMessage}
          onRetryMessage={retryMessage}
          onMessageLocatorReady={setMessageLocator}
        />

        <MessageComposer
          value={draft}
          onChangeText={handleChangeDraft}
          onSend={handleSend}
          canSend={canSend}
          palette={palette}
          disabled={!chat}
          onSendVoice={handleSendVoice}
          onOpenStickerEditor={() => setOpenStickerEditor(true)}
          onChooseTextBackground={setTextCardBg}
          onSendSticker={handleSendSticker}
          stickerVersion={stickerLibraryVersion}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEditing={() => setEditing(null)}
          onSendAttachment={handleSendAttachment}
          onSendContacts={handleSendContacts}
          onCreatePoll={handleCreatePoll}
          onCreateEvent={handleCreateEvent}
        />
      </KeyboardAvoidingView>

      {textCardBg && (
        <TextCardComposer
          palette={palette}
          backgroundColor={textCardBg}
          onClose={() => setTextCardBg(null)}
          onSend={(payload: TextCardPayload) =>
            Handlers.handleSendStyledText?.({
              payload,
              chat,
              currentUserId,
              ensureConversationId,
              sendRichMessage,
              setTextCardBg,
            })
          }
        />
      )}

      {openStickerEditor && (
        <StickerEditor
          palette={palette}
          onClose={() => setOpenStickerEditor(false)}
          onSaveSticker={() => {
            setStickerLibraryVersion((v) => v + 1);
            setOpenStickerEditor(false);
          }}
        />
      )}

      <PinnedMessagesSheet
        visible={pinnedSheetVisible}
        onClose={() => setPinnedSheetVisible(false)}
        roomId={String(storageRoomId)}
        pinnedMessages={pinnedMessages}
        palette={palette}
        onJumpToMessage={(messageId) => {
          setPinnedSheetVisible(false);
          messageLocator?.scrollToMessage(messageId);
          messageLocator?.highlightMessage(messageId);
        }}
      />

      <SubRoomsSheet
        visible={subRoomsSheetVisible}
        onClose={() => setSubRoomsSheetVisible(false)}
        parentRoomId={String(storageRoomId)}
        subRooms={subRooms}
        palette={palette}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  menuRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuBox: {
    position: 'absolute',
    right: 12,
    top: 60,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    width: 220,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});

export default ChatRoomPage;
