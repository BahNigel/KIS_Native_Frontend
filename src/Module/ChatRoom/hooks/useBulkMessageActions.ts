// src/screens/chat/hooks/useBulkMessageActions.ts
import { useCallback } from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import type { ChatMessage } from '../chatTypes';

type UseBulkMessageActionsParams = {
  selectedIds: string[];
  selectedMessages: ChatMessage[];
  messages: ChatMessage[];
  editMessage: (id: string, patch: Partial<ChatMessage>) => Promise<void>;
  softDeleteMessage: (id: string) => Promise<void>;
  exitSelectionMode: () => void;
  isSingleSelection: boolean;
  onReportMessage?: (message: ChatMessage) => void;
  onPinMessage?: (message: ChatMessage, pinned: boolean) => void;
  onContinueInSubRoom?: (message: ChatMessage) => void;
};

export function useBulkMessageActions({
  selectedIds,
  selectedMessages,
  messages,
  editMessage,
  softDeleteMessage,
  exitSelectionMode,
  isSingleSelection,
  onReportMessage,
  onPinMessage,
  onContinueInSubRoom,
}: UseBulkMessageActionsParams) {
  const handlePinSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    for (const msg of selectedMessages) {
      const nextPinned = !msg.isPinned;
      await editMessage(msg.id, { isPinned: nextPinned } as any);
      onPinMessage?.(msg, nextPinned);
    }
    exitSelectionMode();
  }, [editMessage, exitSelectionMode, onPinMessage, selectedIds, selectedMessages]);

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
  }, [exitSelectionMode, selectedIds, softDeleteMessage]);

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
  }, [exitSelectionMode, selectedMessages]);

  const handleContinueInSubRoom = useCallback(() => {
    if (!isSingleSelection) return;

    const msgId = selectedIds[0];
    const message = messages.find((m) => m.id === msgId);
    if (!message) return;

    if (onContinueInSubRoom) {
      onContinueInSubRoom(message);
      return;
    }
    Alert.alert(
      'Sub-room',
      'This will create or open a dedicated sub-room for this message once backend + navigation are wired.',
    );
  }, [isSingleSelection, messages, onContinueInSubRoom, selectedIds]);

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
          const target = selectedMessages[0];
          if (onReportMessage) {
            onReportMessage(target);
            exitSelectionMode();
            return;
          }
          Alert.alert(
            'Reported',
            'Thanks, this message has been reported (local only for now).',
          );
          exitSelectionMode();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [
    exitSelectionMode,
    handleCopySelected,
    handlePinSelected,
    onReportMessage,
    selectedMessages,
  ]);

  return {
    handlePinSelected,
    handleDeleteSelected,
    handleCopySelected,
    handleMoreSelected,
    handleContinueInSubRoom,
  };
}
