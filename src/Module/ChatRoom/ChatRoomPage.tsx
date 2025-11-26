// src/screens/chat/ChatRoomPage.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '../../theme/useTheme';
import { chatRoomStyles as styles } from './chatRoomStyles';

import { ChatHeader } from './componets/main/ChatHeader';
import { MessageList } from './componets/main/MessageList';
import { MessageComposer } from './componets/main/MessageComposer';
import {
  TextCardComposer,
  TextCardPayload,
} from './componets/main/TextCardComposer';
import { StickerEditor, Sticker } from './componets/main/StickerEditor';
import { ForwardChatSheet } from './componets/main/ForwardChatSheet';
import { PinnedMessagesSheet } from './componets/main/PinnedMessagesSheet';
import { SubRoomsSheet } from './componets/main/SubRoomsSheet';

import { useChatAuth } from './hooks/useChatAuth';
import { useConversationBootstrap } from './hooks/useConversationBootstrap';
import { useDraftState } from './hooks/useDraftState';
import { useChatMessaging } from './hooks/useChatMessaging';
import { useSelectionState } from './hooks/useSelectionState';
import { useBulkMessageActions } from './hooks/useBulkMessageActions';

import type {
  ChatMessage,
  ChatRoomPageProps,
  SubRoom,
} from './chatTypes';

type ExtendedChatRoomPageProps = ChatRoomPageProps & {
  hideHeader?: boolean;
};

type MessageLocator = {
  scrollToMessage: (messageId: string) => void;
  highlightMessage: (messageId: string) => void;
};

export const ChatRoomPage: React.FC<ExtendedChatRoomPageProps> = ({
  chat,
  onBack,
  allChats = [],
  onForwardMessages,
  hideHeader,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    console.log('[ChatRoomPage] chat prop:', chat);
  }, [chat]);

  const { authToken, currentUserId, currentUserName } = useChatAuth(chat);

  const {
    isDirectChat,
    conversationId,
    storageRoomId,
    ensureConversationId,
  } = useConversationBootstrap(chat, authToken);

  const {
    draft,
    setDraft,
    draftKey,
    draftsByKey,
    setDraftsByKey,
    handleChangeDraft,
  } = useDraftState(conversationId, chat?.id);

  const [openStickerEditor, setOpenStickerEditor] = useState(false);
  const [textCardBg, setTextCardBg] = useState<string | null>(null);
  const [stickerLibraryVersion, setStickerLibraryVersion] = useState(0);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);

  const [forwardSheetVisible, setForwardSheetVisible] = useState(false);
  const [pinnedSheetVisible, setPinnedSheetVisible] = useState(false);
  const [subRoomsSheetVisible, setSubRoomsSheetVisible] = useState(false);

  const [subRooms] = useState<SubRoom[]>([]);
  const [messageLocator, setMessageLocator] = useState<MessageLocator | null>(
    null,
  );

  const {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
  } = useChatMessaging({
    chat,
    authToken,
    storageRoomId,
    currentUserId,
    currentUserName,
    conversationId,
  });

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
  });

  const isEmpty = !chat;
  const canSend = useMemo(() => draft.trim().length > 0, [draft]);
  const bgColor = palette.chatBg ?? palette.bg;

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !chat) return;

    const convId = await ensureConversationId(text);
    if (!convId) return;

    if (editing) {
      await editMessage(editing.id, {
        text,
        isEdited: true,
        status: 'pending',
        conversationId: convId,
      } as any);
      setEditing(null);
    } else if (replyTo) {
      await replyToMessage(replyTo, text, {
        kind: 'text',
        fromMe: true,
        senderId: currentUserId,
        conversationId: convId,
      } as any);
      setReplyTo(null);
    } else {
      await sendTextMessage(text, {
        kind: 'text',
        fromMe: true,
        senderId: currentUserId,
        conversationId: convId,
      } as any);
    }

    setDraft('');
    setDraftsByKey((prev) => ({
      ...prev,
      [draftKey]: '',
    }));
  }, [
    chat,
    draft,
    draftKey,
    editMessage,
    editing,
    ensureConversationId,
    replyTo,
    replyToMessage,
    sendTextMessage,
    currentUserId,
    setDraft,
    setDraftsByKey,
    setEditing,
    setReplyTo,
  ]);

  const handleSendVoice = useCallback(
    async ({ uri, durationMs }: { uri: string; durationMs: number }) => {
      if (!chat) return;
      const convId = await ensureConversationId('Voice message');
      if (!convId) return;

      await sendRichMessage({
        kind: 'voice',
        fromMe: true,
        senderId: currentUserId,
        voice: { uri, durationMs },
        conversationId: convId,
      } as any);
    },
    [chat, ensureConversationId, currentUserId, sendRichMessage],
  );

  const handleSendStyledText = useCallback(
    async (payload: TextCardPayload) => {
      if (!chat) return;

      const preview = payload.text ?? 'Styled message';
      const convId = await ensureConversationId(preview);
      if (!convId) return;

      await sendRichMessage({
        kind: 'styled_text',
        fromMe: true,
        senderId: currentUserId,
        text: payload.text,
        styledText: {
          text: payload.text,
          backgroundColor: payload.backgroundColor,
          fontSize: payload.fontSize,
          fontColor: payload.fontColor,
          fontFamily: payload.fontFamily,
        },
        conversationId: convId,
      } as any);

      setTextCardBg(null);
    },
    [chat, currentUserId, ensureConversationId, sendRichMessage],
  );

  const handleSendSticker = useCallback(
    async (sticker: Sticker) => {
      if (!chat) return;

      const convId = await ensureConversationId('Sticker');
      if (!convId) return;

      await sendRichMessage({
        kind: 'sticker',
        fromMe: true,
        senderId: currentUserId,
        sticker: {
          id: sticker.id,
          uri: sticker.uri,
          text: sticker.text,
        },
        conversationId: convId,
      } as any);
    },
    [chat, currentUserId, ensureConversationId, sendRichMessage],
  );

  const handleReplyRequest = useCallback(
    (message: ChatMessage) => {
      if (selectionMode) {
        toggleSelectMessage(message);
        return;
      }
      setReplyTo(message);
    },
    [selectionMode, toggleSelectMessage],
  );

  const handleEditRequest = useCallback(
    (message: ChatMessage) => {
      if (!message.fromMe) {
        Alert.alert('Cannot edit', 'You can only edit your own messages.');
        return;
      }
      setEditing(message);
      setDraft(message.text ?? '');
      setDraftsByKey((prev) => ({
        ...prev,
        [draftKey]: message.text ?? '',
      }));
    },
    [draftKey, setDraft, setDraftsByKey],
  );

  const handlePressMessage = useCallback(
    (message: ChatMessage) => {
      if (selectionMode) {
        toggleSelectMessage(message);
      }
    },
    [selectionMode, toggleSelectMessage],
  );

  const handleLongPressMessage = useCallback(
    (message: ChatMessage) => {
      if (!selectionMode) {
        enterSelectionMode(message);
      }
    },
    [selectionMode, enterSelectionMode],
  );

  const handleForwardSelected = useCallback(() => {
    if (!selectedMessages.length) return;
    setForwardSheetVisible(true);
  }, [selectedMessages]);

  const handleConfirmForward = useCallback(
    (chatIds: string[]) => {
      setForwardSheetVisible(false);
      if (!chatIds.length || !selectedMessages.length) return;

      if (onForwardMessages) {
        onForwardMessages({
          fromRoomId: storageRoomId,
          toChatIds: chatIds,
          messages: selectedMessages,
        });
      } else {
        console.log('Forward messages to chats', { chatIds, selectedMessages });
      }

      exitSelectionMode();
    },
    [
      exitSelectionMode,
      onForwardMessages,
      selectedMessages,
      storageRoomId,
      setForwardSheetVisible,
    ],
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: bgColor,
          paddingTop: insets.top,
        },
      ]}
    >
      {!hideHeader && (
        <ChatHeader
          chat={chat}
          onBack={selectionMode ? exitSelectionMode : onBack}
          palette={palette}
          selectionMode={selectionMode}
          selectedCount={selectedIds.length}
          onCancelSelection={exitSelectionMode}
          onPinSelected={handlePinSelected}
          onDeleteSelected={handleDeleteSelected}
          onForwardSelected={handleForwardSelected}
          onCopySelected={handleCopySelected}
          onMoreSelected={handleMoreSelected}
          pinnedCount={pinnedCount}
          subRoomCount={subRoomCount}
          onOpenPinned={() => setPinnedSheetVisible(true)}
          onOpenSubRooms={() => setSubRoomsSheetVisible(true)}
          isSingleSelection={isSingleSelection}
          onContinueInSubRoom={handleContinueInSubRoom}
        />
      )}

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <MessageList
          messages={messages}
          palette={palette}
          isEmpty={isEmpty}
          onReplyToMessage={handleReplyRequest}
          onEditMessage={handleEditRequest}
          onPressMessage={handlePressMessage}
          onLongPressMessage={handleLongPressMessage}
          selectionMode={selectionMode}
          selectedMessageIds={selectedIds}
          onStartSelection={enterSelectionMode}
          onToggleSelect={toggleSelectMessage}
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
          onChooseTextBackground={(bg) => setTextCardBg(bg)}
          onOpenStickerEditor={() => setOpenStickerEditor(true)}
          onSendSticker={handleSendSticker}
          stickerVersion={stickerLibraryVersion}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEditing={() => setEditing(null)}
        />
      </KeyboardAvoidingView>

      {textCardBg && (
        <TextCardComposer
          palette={palette}
          backgroundColor={textCardBg}
          onClose={() => setTextCardBg(null)}
          onSend={handleSendStyledText}
        />
      )}

      {openStickerEditor && (
        <StickerEditor
          palette={palette}
          onClose={() => setOpenStickerEditor(false)}
          onSaveSticker={(sticker) => {
            setStickerLibraryVersion((v) => v + 1);
            setOpenStickerEditor(false);
          }}
        />
      )}

      <ForwardChatSheet
        visible={forwardSheetVisible}
        palette={palette}
        chats={allChats}
        maxTargets={5}
        onClose={() => setForwardSheetVisible(false)}
        onConfirm={handleConfirmForward}
      />

      <PinnedMessagesSheet
        visible={pinnedSheetVisible}
        onClose={() => setPinnedSheetVisible(false)}
        roomId={storageRoomId}
        pinnedMessages={pinnedMessages}
        palette={palette}
        onJumpToMessage={(messageId: string) => {
          if (!messageLocator) return;
          setPinnedSheetVisible(false);
          messageLocator.scrollToMessage(messageId);
          messageLocator.highlightMessage(messageId);
        }}
      />

      <SubRoomsSheet
        visible={subRoomsSheetVisible}
        onClose={() => setSubRoomsSheetVisible(false)}
        parentRoomId={storageRoomId}
        subRooms={subRooms}
        palette={palette}
      />
    </View>
  );
};

export default ChatRoomPage;
