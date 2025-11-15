// src/screens/chat/components/ChatHeader.tsx

import React, { useMemo } from 'react';
import { View, Text, Pressable, Image } from 'react-native';

import type { Chat } from '@/components/messaging/messagesUtils';
import { chatRoomStyles as styles } from '../chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';

type ChatHeaderProps = {
  chat: Chat | null;
  onBack: () => void;
  palette: any;

  // NEW: selection mode support
  selectionMode?: boolean;
  selectedCount?: number;
  onCancelSelection?: () => void;
  onPinSelected?: () => void;
  onDeleteSelected?: () => void;
  onForwardSelected?: () => void;
  onCopySelected?: () => void;
  onMoreSelected?: () => void;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  onBack,
  palette,
  selectionMode = false,
  selectedCount = 0,
  onCancelSelection,
  onPinSelected,
  onDeleteSelected,
  onForwardSelected,
  onCopySelected,
  onMoreSelected,
}) => {
  const title = chat?.name ?? 'Chat';

  const initials = useMemo(() => {
    if (!title) return '?';
    return title
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [title]);

  // Fake status like WhatsApp (you can later wire to real presence)
  const statusText = 'online';

  /* ─────────────────────────────────────────
   * 1) Selection mode header
   * ──────────────────────────────────────── */
  if (selectionMode) {
    return (
      <View
        style={[
          styles.header,
          {
            borderBottomColor: palette.divider,
            backgroundColor: palette.chatHeaderBg ?? palette.card,
          },
        ]}
      >
        {/* Back / cancel selection */}
        <Pressable
          onPress={onCancelSelection ?? onBack}
          style={({ pressed }) => [
            styles.headerBackButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <KISIcon
            name="arrow-left"
            size={22}
            color={palette.onHeader ?? palette.primary}
          />
        </Pressable>

        {/* Selected count */}
        <View style={styles.headerCenter}>
          <Text
            style={[
              styles.headerTitle,
              {
                color: palette.onHeader ?? palette.text,
              },
            ]}
            numberOfLines={1}
          >
            {selectedCount} selected
          </Text>
        </View>

        {/* Actions: pin, delete, forward, copy, more */}
        <View style={styles.headerActions}>
          {/* Pin */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onPinSelected?.()}
          >
            <KISIcon
              name="pin"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* Delete */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onDeleteSelected?.()}
          >
            <KISIcon
              name="trash"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* Forward */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onForwardSelected?.()}
          >
            <KISIcon
              name="forward"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* Copy */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onCopySelected?.()}
          >
            <KISIcon
              name="copy"
              size={18}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* More (dropdown menu: copy, pin, report – handled in parent) */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onMoreSelected?.()}
          >
            <KISIcon
              name="more-vert"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 2) Normal chat header
   * ──────────────────────────────────────── */
  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: palette.divider,
          backgroundColor: palette.chatHeaderBg ?? palette.card,
        },
      ]}
    >
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [
          styles.headerBackButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <KISIcon
          name="arrow-left"
          size={22}
          color={palette.onHeader ?? palette.primary}
        />
      </Pressable>

      {/* Avatar + name + status */}
      <View style={styles.headerCenter}>
        {chat?.avatarUrl ? (
          <Image
            source={{ uri: chat.avatarUrl }}
            style={styles.headerAvatar}
          />
        ) : (
          <View
            style={[
              styles.headerAvatar,
              {
                backgroundColor:
                  palette.avatarBg ??
                  palette.primarySoft ??
                  palette.surface,
              },
            ]}
          >
            <Text
              style={{
                color: palette.onAvatar ?? palette.text,
                fontWeight: '600',
              }}
            >
              {initials}
            </Text>
          </View>
        )}

        <View style={{ marginLeft: 10 }}>
          <Text
            style={[
              styles.headerTitle,
              { color: palette.onHeader ?? palette.text },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: palette.headerSubtext ?? palette.subtext },
            ]}
            numberOfLines={1}
          >
            {statusText}
          </Text>
        </View>
      </View>

      {/* WhatsApp-like actions: camera, mic, menu */}
      <View style={styles.headerActions}>
        <Pressable style={styles.headerIconButton}>
          <KISIcon
            name="camera"
            size={20}
            color={palette.onHeader ?? palette.text}
          />
        </Pressable>
        <Pressable style={styles.headerIconButton}>
          <KISIcon
            name="mic"
            size={20}
            color={palette.onHeader ?? palette.text}
          />
        </Pressable>
        <Pressable style={styles.headerIconButton}>
          <KISIcon
            name="menu"
            size={20}
            color={palette.onHeader ?? palette.text}
          />
        </Pressable>
      </View>
    </View>
  );
};
