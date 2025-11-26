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
};

export function useBulkMessageActions({
  selectedIds,
  selectedMessages,
  messages,
  editMessage,
  softDeleteMessage,
  exitSelectionMode,
  isSingleSelection,
}: UseBulkMessageActionsParams) {
  const handlePinSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    for (const id of selectedIds) {
      await editMessage(id, { isPinned: true } as any);
    }
    exitSelectionMode();
  }, [editMessage, exitSelectionMode, selectedIds]);

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

    Alert.alert(
      'Sub-room',
      'This will create or open a dedicated sub-room for this message once backend + navigation are wired.',
    );
  }, [isSingleSelection, messages, selectedIds]);

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
  }, [exitSelectionMode, handleCopySelected, handlePinSelected, selectedMessages]);

  return {
    handlePinSelected,
    handleDeleteSelected,
    handleCopySelected,
    handleMoreSelected,
    handleContinueInSubRoom,
  };
}
