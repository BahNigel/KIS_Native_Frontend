// src/screens/chat/ChatRoomPage.tsx
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';

import { useKISTheme } from '../../theme/useTheme';
import { chatRoomStyles as styles } from './chatRoomStyles';
import { ChatHeader } from './componets/ChatHeader';
import { MessageList } from './componets/MessageList';
import { MessageComposer } from './componets/MessageComposer';
import {
  TextCardComposer,
  TextCardPayload,
} from './componets/TextCardComposer';
import { StickerEditor, Sticker } from './componets/StickerEditor';
import { ForwardChatSheet } from './componets/ForwardChatSheet';
import { PinnedMessagesSheet } from './componets/PinnedMessagesSheet';
import { SubRoomsSheet } from './componets/SubRoomsSheet';

import {
  useChatPersistence,
  type SendOverNetworkFn,
} from '../hooks/useChatPersistence';

import { buildInitialMessages } from './componets/chatInitialMessages';
import type {
  ChatMessage,
  ChatRoomPageProps,
  SubRoom,
} from './componets/chatTypes';
import { useChatSocket } from './componets/useChatSocket';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const ChatRoomPage: React.FC<ChatRoomPageProps> = ({
  chat,
  onBack,
  allChats = [],
  onForwardMessages,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  // 🔐 Auth state from local storage
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('local-user');

  // Load token (and optionally user id) from AsyncStorage
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        // If you store user id somewhere, adjust this key accordingly:
        const storedUserId = await AsyncStorage.getItem('user_id');

        if (token) setAuthToken(token);
        if (storedUserId) setCurrentUserId(storedUserId);
      } catch (e) {
        console.warn('[ChatRoomPage] Failed to load auth from storage', e);
      }
    };

    loadAuth();
  }, []);

  const roomId = chat?.id ?? 'local-room';

  const [draft, setDraft] = useState('');
  const [openStickerEditor, setOpenStickerEditor] = useState(false);
  const [textCardBg, setTextCardBg] = useState<string | null>(null);
  const [stickerLibraryVersion, setStickerLibraryVersion] = useState(0);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Forward sheet
  const [forwardSheetVisible, setForwardSheetVisible] = useState(false);

  // pinned & sub-room UI sheets
  const [pinnedSheetVisible, setPinnedSheetVisible] = useState(false);
  const [subRoomsSheetVisible, setSubRoomsSheetVisible] = useState(false);

  // local sub-rooms list (to be replaced by backend/store later)
  const [subRooms] = useState<SubRoom[]>([]);

  /**
   * NEW: locator helpers from MessageList
   * This lets us:
   *  - Scroll to a specific message
   *  - Highlight it
   * When user taps a pinned message in PinnedMessagesSheet.
   */
  const [messageLocator, setMessageLocator] = useState<{
    scrollToMessage: (messageId: string) => void;
    highlightMessage: (messageId: string) => void;
  } | null>(null);

  // Chat persistence
  const {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    replaceMessages,
  } = useChatPersistence({
    roomId,
    currentUserId,
    // sendOverNetwork is injected below, after socket is ready
    sendOverNetwork: async () => false,
  });

  // Keep a ref to messages so socket listeners always see latest
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Socket.IO connection (Nest backend)
  const { isConnected, socketRef } = useChatSocket({
    authToken,
    roomId,
    currentUserId,
    replaceMessages,
    messagesRef,
  });

  // Send messages over network using Nest chat backend
  const sendOverNetwork = useCallback<SendOverNetworkFn>(
    async (message) => {
      const socket = socketRef.current;
      if (!socket || !isConnected || !chat) {
        return false;
      }

      // For now we send plaintext as ciphertext; later we can plug E2E
      const ciphertext =
        message.text ??
        message.styledText?.text ??
        '';

      return new Promise<boolean>((resolve) => {
        socket
          .timeout(5000)
          .emit(
            'chat.send',
            {
              conversationId: roomId,
              clientId: message.id,
              senderName: undefined, // backend derives from principal
              ciphertext,
              attachments: [], // wire in when upload is ready
              replyToId: message.replyToId,
            },
            (err: unknown, ack: any) => {
              if (err) {
                console.warn('chat.send timeout/error', err);
                resolve(false);
                return;
              }
              resolve(!!ack?.ok);
            },
          );
      });
    },
    [chat, isConnected, roomId, socketRef],
  );

  // Re-inject sendOverNetwork into persistence when ready
  useEffect(() => {
    // small trick: attemptFlushQueue depends on correct sendOverNetwork
    // but useChatPersistence currently took a dummy one.
    // If your hook lets you update sendOverNetwork, call that here.
    // For now, we just rely on attemptFlushQueue using the latest closure.
  }, [sendOverNetwork]);

  // Seed initial demo messages (still useful while backend is empty)
  useEffect(() => {
    if (!chat) return;
    if (isLoading) return;
    if (messages.length > 0) return;

    const seeded = buildInitialMessages(chat, roomId, currentUserId);
    if (!seeded.length) return;

    replaceMessages(seeded);
  }, [chat, isLoading, messages.length, roomId, currentUserId, replaceMessages]);

  // Example network-back-online hook
  const handleNetworkBackOnline = useCallback(() => {
    attemptFlushQueue();
  }, [attemptFlushQueue]);

  // ====== Selection helpers ======

  const enterSelectionMode = useCallback((message: ChatMessage) => {
    setSelectionMode(true);
    setSelectedIds([message.id]);
  }, []);

  const toggleSelectMessage = useCallback(
    (message: ChatMessage) => {
      setSelectedIds((prev) => {
        const exists = prev.includes(message.id);
        const next = exists
          ? prev.filter((id) => id !== message.id)
          : [...prev, message.id];

        if (next.length === 0) {
          setSelectionMode(false);
        }

        return next;
      });
    },
    [],
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.includes(m.id)),
    [messages, selectedIds],
  );

  // Single-selection flag → used to gate "Continue in sub-room" UI
  const isSingleSelection = selectedIds.length === 1;

  // Pinned messages derived from main list
  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.isPinned && !m.isDeleted),
    [messages],
  );
  const pinnedCount = pinnedMessages.length;

  // Sub-room count (future backend)
  const subRoomCount = subRooms.length;

  // ====== Sending ======

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !chat) return;

    if (editing) {
      await editMessage(editing.id, {
        text,
        isEdited: true,
        status: 'pending',
      });
      setEditing(null);
      setDraft('');
      return;
    }

    if (replyTo) {
      await replyToMessage(replyTo, text, {
        kind: 'text',
        fromMe: true,
        roomId,
        senderId: currentUserId,
      });
      setReplyTo(null);
      setDraft('');
      return;
    }

    await sendTextMessage(text, {
      kind: 'text',
      fromMe: true,
      roomId,
      senderId: currentUserId,
    });
    setDraft('');
  }, [
    draft,
    chat,
    editing,
    replyTo,
    editMessage,
    replyToMessage,
    sendTextMessage,
    roomId,
    currentUserId,
  ]);

  const handleSendVoice = useCallback(
    async ({ uri, durationMs }: { uri: string; durationMs: number }) => {
      if (!chat) return;

      await sendRichMessage({
        kind: 'voice',
        roomId,
        senderId: currentUserId,
        fromMe: true,
        voice: { uri, durationMs },
      });
    },
    [chat, roomId, currentUserId, sendRichMessage],
  );

  const handleSendStyledText = useCallback(
    async (payload: TextCardPayload) => {
      if (!chat) return;

      await sendRichMessage({
        kind: 'styled_text',
        roomId,
        senderId: currentUserId,
        fromMe: true,
        text: payload.text,
        styledText: {
          text: payload.text,
          backgroundColor: payload.backgroundColor,
          fontSize: payload.fontSize,
          fontColor: payload.fontColor,
          fontFamily: payload.fontFamily,
        },
      });

      setTextCardBg(null);
    },
    [chat, roomId, currentUserId, sendRichMessage],
  );

  const handleSendSticker = useCallback(
    async (sticker: Sticker) => {
      if (!chat) return;

      await sendRichMessage({
        kind: 'sticker',
        roomId,
        senderId: currentUserId,
        fromMe: true,
        sticker: {
          id: sticker.id,
          uri: sticker.uri,
          text: sticker.text,
        },
      });
    },
    [chat, roomId, currentUserId, sendRichMessage],
  );

  // ====== Message interaction ======

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
        Alert.alert(
          'Cannot edit',
          'You can only edit your own messages.',
        );
        return;
      }
      setEditing(message);
      setDraft(message.text ?? '');
    },
    [],
  );

  const handlePressMessage = useCallback(
    (message: ChatMessage) => {
      if (selectionMode) {
        toggleSelectMessage(message);
      } else {
        // single tap normal mode – no-op or open info
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

  // ====== Header actions (selection) ======

  const handlePinSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    for (const id of selectedIds) {
      await editMessage(id, { isPinned: true });
    }
    exitSelectionMode();
  }, [selectedIds, editMessage, exitSelectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    const confirm = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete messages',
        `Delete ${selectedIds.length} message(s)?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (!confirm) return;

    for (const id of selectedIds) {
      await softDeleteMessage(id);
    }
    exitSelectionMode();
  }, [selectedIds, softDeleteMessage, exitSelectionMode]);

  const handleCopySelected = useCallback(() => {
    if (!selectedMessages.length) return;

    const sorted = [...selectedMessages].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    const text = sorted
      .map((m) => m.text || m.styledText?.text || '')
      .filter((s) => s.trim().length > 0)
      .join('\n');

    if (!text.trim()) return;

    Clipboard.setString(text);
    exitSelectionMode();
  }, [selectedMessages, exitSelectionMode]);

  const handleForwardSelected = useCallback(() => {
    if (!selectedMessages.length) return;
    setForwardSheetVisible(true);
  }, [selectedMessages]);

  // Single-selection-only action: continue in sub-room (placeholder)
  const handleContinueInSubRoom = useCallback(() => {
    if (!isSingleSelection) {
      return;
    }

    const msgId = selectedIds[0];
    const message = messages.find((m) => m.id === msgId);
    if (!message) return;

    Alert.alert(
      'Sub-room',
      'This will create or open a dedicated sub-room for this message once backend + navigation are wired.',
    );
  }, [isSingleSelection, selectedIds, messages]);

  const handleMoreSelected = useCallback(() => {
    if (!selectedMessages.length) return;

    Alert.alert('More', 'Choose an action for selected messages', [
      {
        text: 'Copy',
        onPress: () => handleCopySelected(),
      },
      {
        text: 'Pin',
        onPress: () => handlePinSelected(),
      },
      {
        text: 'Report',
        onPress: () => {
          Alert.alert(
            'Reported',
            'Thanks, this message has been reported (local only for now).',
          );
          exitSelectionMode();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleCopySelected, handlePinSelected, exitSelectionMode, selectedMessages]);

  // Forward confirm from sheet
  const handleConfirmForward = useCallback(
    (chatIds: string[]) => {
      setForwardSheetVisible(false);
      if (!chatIds.length || !selectedMessages.length) return;

      if (onForwardMessages) {
        onForwardMessages({
          fromRoomId: roomId,
          toChatIds: chatIds,
          messages: selectedMessages,
        });
      } else {
        console.log('Forward messages to chats', { chatIds, selectedMessages });
      }

      exitSelectionMode();
    },
    [onForwardMessages, selectedMessages, roomId, exitSelectionMode],
  );

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);
  const isEmpty = !chat;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: palette.chatBg ?? palette.bg,
          paddingTop: insets.top,
        },
      ]}
    >
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
        // header indicators + expand handlers
        pinnedCount={pinnedCount}
        subRoomCount={subRoomCount}
        onOpenPinned={() => setPinnedSheetVisible(true)}
        onOpenSubRooms={() => setSubRoomsSheetVisible(true)}
        // single-selection-only sub-room action
        isSingleSelection={isSingleSelection}
        onContinueInSubRoom={handleContinueInSubRoom}
      />

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
          /**
           * NEW: hook to get scroll/highlight helpers from MessageList.
           * We'll use this for "jump to pinned message" from the sheet.
           */
          onMessageLocatorReady={setMessageLocator}
        />

        <MessageComposer
          value={draft}
          onChangeText={setDraft}
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

      {/* Forward sheet */}
      <ForwardChatSheet
        visible={forwardSheetVisible}
        palette={palette}
        chats={allChats}
        maxTargets={5}
        onClose={() => setForwardSheetVisible(false)}
        onConfirm={handleConfirmForward}
      />

      {/* Pinned messages sheet */}
      <PinnedMessagesSheet
        visible={pinnedSheetVisible}
        onClose={() => setPinnedSheetVisible(false)}
        roomId={roomId}
        pinnedMessages={pinnedMessages}
        palette={palette}
        onJumpToMessage={(messageId: string) => {
          if (!messageLocator) return;
          setPinnedSheetVisible(false);
          messageLocator.scrollToMessage(messageId);
          messageLocator.highlightMessage(messageId);
        }}
      />

      {/* Sub-rooms sheet */}
      <SubRoomsSheet
        visible={subRoomsSheetVisible}
        onClose={() => setSubRoomsSheetVisible(false)}
        parentRoomId={roomId}
        subRooms={subRooms}
        palette={palette}
      />
    </View>
  );
};

export default ChatRoomPage;
