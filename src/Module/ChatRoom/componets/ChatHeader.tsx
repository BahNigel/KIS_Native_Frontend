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

  // Selection mode support
  selectionMode?: boolean;
  selectedCount?: number;
  onCancelSelection?: () => void;
  onPinSelected?: () => void;
  onDeleteSelected?: () => void;
  onForwardSelected?: () => void;
  onCopySelected?: () => void;
  onMoreSelected?: () => void;

  // NEW: pinned + sub-room header indicators
  pinnedCount?: number;
  subRoomCount?: number;
  onOpenPinned?: () => void;
  onOpenSubRooms?: () => void;

  // NEW: single-selection-only sub-room action
  isSingleSelection?: boolean;
  onContinueInSubRoom?: () => void;
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

  pinnedCount = 0,
  subRoomCount = 0,
  onOpenPinned,
  onOpenSubRooms,

  isSingleSelection = false,
  onContinueInSubRoom,
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

        {/* Actions: pin, delete, forward, copy, sub-room (single only), more */}
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

          {/* NEW: Continue in sub-room (only when exactly one message is selected) */}
          {isSingleSelection && (
            <Pressable
              style={styles.headerIconButton}
              onPress={() => onContinueInSubRoom?.()}
            >
              {/* NOTE: adjust icon name if needed to match your KISIcon set */}
              <KISIcon
                name="sub-channel"
                size={20}
                color={palette.onHeader ?? palette.text}
              />
            </Pressable>
          )}

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
   * 2) Normal chat header + info strip
   * ──────────────────────────────────────── */
  const showInfoStrip = pinnedCount > 0 || subRoomCount > 0;

  const pillBaseStyle = {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  };

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: palette.divider,
          backgroundColor: "transparent",
          // Override any row flexDirection so we can stack main row + info row
          flexDirection: 'column',
        },
      ]}
    >
      {/* Top row: back + avatar + title + actions */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
        }}
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

      {/* NEW: info strip – pinned + sub-rooms pills under the header */}
      {showInfoStrip && (
        <View
          style={{
            width: '100%',
            paddingHorizontal: 16,
            paddingBottom: 6,
            paddingTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {pinnedCount > 0 && (
            <Pressable
              onPress={() => onOpenPinned?.()}
              style={({ pressed }) => [
                pillBaseStyle,
                {
                  backgroundColor:
                    palette.pillPinnedBg ??
                    palette.surfaceSoft ??
                    palette.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <KISIcon
                name="pin"
                size={14}
                color={palette.onHeader ?? palette.text}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: palette.onHeader ?? palette.text,
                }}
              >
                Pinned ({pinnedCount})
              </Text>
            </Pressable>
          )}

          {subRoomCount > 0 && (
            <Pressable
              onPress={() => onOpenSubRooms?.()}
              style={({ pressed }) => [
                pillBaseStyle,
                {
                  marginLeft: pinnedCount > 0 ? 8 : 0,
                  backgroundColor:
                    palette.pillSubRoomBg ??
                    palette.surfaceSoft ??
                    palette.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {/* NOTE: adjust icon name if needed to match your KISIcon set */}
              <KISIcon
                name="layers"
                size={14}
                color={palette.onHeader ?? palette.text}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: palette.onHeader ?? palette.text,
                }}
              >
                Sub-rooms ({subRoomCount})
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};
