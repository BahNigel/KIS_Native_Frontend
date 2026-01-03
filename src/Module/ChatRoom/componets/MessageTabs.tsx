// src/screens/tabs/MessageTabs.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

import { useKISTheme } from '@/theme/useTheme';
import { KIS_TOKENS } from '@/theme/constants';
import { KISIcon } from '@/constants/kisIcons';

import {
  styles,
  type Chat,
  type CustomFilter,
  type QuickChip,
  applyQuickChips,
  applyCustomRules,
  bySearch,
  participantsToIds,
  normalizePhoneKey,
  otherParticipantPhone,
} from '../messagesUtils';
import { normalizeConversation } from '../normalizeConversation';


type ChatsTabProps = {
  conversations: any[]; // raw backend conversations
  filters: CustomFilter[];
  activeQuick: Set<QuickChip>;
  activeCustomId?: string | null;
  search: string;
  typingByConversation?: Record<string, Record<string, number>>;
  presenceByUser?: Record<string, { isOnline: boolean; at: number }>;
  currentUserId?: string;
  conversationMeta?: Record<string, { lastMessage?: string; lastAt?: string; unreadCount?: number }>;
  contactNameByPhone?: Record<string, string>;

  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onEndReached?: () => void;
  onOpenChat?: (chat: Chat) => void;

  selectedChat?: Chat[];
  setSelectedChat?: (chats: Chat[]) => void;
};

export function ChatsTab({
  conversations = [],
  filters,
  activeQuick,
  activeCustomId,
  search,
  typingByConversation,
  presenceByUser,
  currentUserId,
  conversationMeta,
  contactNameByPhone,
  onScroll,
  onEndReached,
  onOpenChat,
  selectedChat = [],
  setSelectedChat,
}: ChatsTabProps) {
  const { palette } = useKISTheme();

  /* ------------------------------------------------------------
   * NORMALIZE RAW BACKEND CONVERSATIONS → SAFE Chat objects
   * ------------------------------------------------------------ */
  const normalizedChats: Chat[] = useMemo(() => {
    return conversations.map((c) => normalizeConversation(c, currentUserId));
  }, [conversations, currentUserId]);

  /* ------------------------------------------------------------
   * ACTIVE CUSTOM FILTER RULES
   * ------------------------------------------------------------ */
  const customRules = useMemo(
    () => filters.find((f) => f.id === activeCustomId)?.rules,
    [filters, activeCustomId]
  );

  const selectionMode = selectedChat.length > 0;

  /* ------------------------------------------------------------
   * FINAL FILTERED DATA
   * ------------------------------------------------------------ */
  const data = useMemo(() => {
    const filtered = normalizedChats.filter(
      (c: Chat) =>
        applyQuickChips(c, activeQuick) &&
        applyCustomRules(c, customRules) &&
        bySearch(c, search)
    );

    const getLastAt = (item: Chat) => {
      const convId = String((item as any).conversationId ?? item.id);
      const meta = conversationMeta?.[convId];
      const metaAt = meta?.lastAt ?? '';
      const itemAt = item.lastAt ?? '';
      const metaTs = Date.parse(metaAt || '');
      const itemTs = Date.parse(itemAt || '');
      if (!Number.isNaN(metaTs) && (Number.isNaN(itemTs) || metaTs >= itemTs)) {
        return metaAt;
      }
      return itemAt;
    };

    return filtered.sort((a, b) => {
      const aAt = getLastAt(a);
      const bAt = getLastAt(b);
      const aTs = Date.parse(aAt || '');
      const bTs = Date.parse(bAt || '');
      if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) return bTs - aTs;
      if (!Number.isNaN(aTs)) return -1;
      if (!Number.isNaN(bTs)) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [normalizedChats, activeQuick, customRules, search, conversationMeta]);

  /* ------------------------------------------------------------
   * CHAT SELECTION HANDLING
   * ------------------------------------------------------------ */
  const toggleSelectChat = (chat: Chat) => {
    if (!setSelectedChat) return;

    const exists = selectedChat.some((c) => c.id === chat.id);
    if (exists) {
      setSelectedChat(selectedChat.filter((c) => c.id !== chat.id));
    } else {
      setSelectedChat([...selectedChat, chat]);
    }
  };

  /* ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------ */
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(i) => i.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
      ListEmptyComponent={
        <View style={[styles.center, { paddingVertical: 60 }]}>
          <Text style={{ color: palette.subtext }}>
            No chats match your filters.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isSelected = selectedChat.some((c) => c.id === item.id);
        const convId = String((item as any).conversationId ?? item.id);
        const meta = conversationMeta?.[convId];
        const metaAt = meta?.lastAt ?? '';
        const itemAt = item.lastAt ?? '';
        const metaTs = Date.parse(metaAt || '');
        const itemTs = Date.parse(itemAt || '');
        const useMeta =
          metaAt &&
          (!Number.isNaN(metaTs) &&
            (Number.isNaN(itemTs) || metaTs >= itemTs));
        const displayLastMessage = useMeta
          ? meta?.lastMessage ?? ''
          : item.lastMessage ?? '';
        const displayLastAt = useMeta ? metaAt : itemAt;
        const displayUnread = useMeta
          ? meta?.unreadCount ?? 0
          : item.unreadCount ?? 0;

        const handlePress = () => {
          const displayName = (() => {
            if (item.isDirect) {
              const phone = otherParticipantPhone(item.participants ?? [], currentUserId);
              const key = normalizePhoneKey(phone);
              if (key && contactNameByPhone?.[key]) return contactNameByPhone[key];
            }
            return item.name;
          })();

          if (selectionMode) {
            toggleSelectChat(item);
          } else {
            onOpenChat?.({ ...item, name: displayName });
          }
        };

        const handleLongPress = () => {
          toggleSelectChat(item);
        };

        return (
          <Pressable
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={[
              styles.row,
              {
                backgroundColor: isSelected
                  ? palette.primarySoft
                  : palette.card,
                borderColor: isSelected
                  ? palette.primaryStrong
                  : palette.inputBorder,
              },
              KIS_TOKENS.elevation.card,
            ]}
          >
            {/* AVATAR (placeholder until real avatar support) */}
            <View style={{ position: 'relative' }}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: palette.divider },
                ]}
              />

              {item.isDirect && (() => {
                const ids = participantsToIds(item.participants ?? []);
                const otherId = ids.find((u) => u && u !== currentUserId);
                const online = otherId ? presenceByUser?.[otherId]?.isOnline : false;
                if (!online) return null;
                return (
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: '#34C759',
                      borderWidth: 2,
                      borderColor: palette.card,
                    }}
                  />
                );
              })()}

              {isSelected && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    borderRadius: 30,
                  }}
                >
                  <Text
                    style={{
                      color: palette.primaryStrong,
                      fontSize: 22,
                      fontWeight: 'bold',
                    }}
                  >
                    ✓
                  </Text>
                </View>
              )}
            </View>

            {/* NAME + LAST MESSAGE */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.name, { color: palette.text }]}>
                  {(() => {
                    if (item.isDirect) {
                      const phone = otherParticipantPhone(item.participants ?? [], currentUserId);
                      const key = normalizePhoneKey(phone);
                      if (key && contactNameByPhone?.[key]) return contactNameByPhone[key];
                    }
                    return item.name;
                  })()}
                </Text>
                {item.isBlocked && (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: palette.error ?? palette.primary,
                    }}
                  >
                    <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 10 }}>
                      Blocked
                    </Text>
                  </View>
                )}
                {item.isMuted && (
                  <KISIcon
                    name="volume-mute"
                    size={14}
                    color={palette.subtext}
                  />
                )}
              </View>

              <Text
                style={{ color: palette.subtext }}
                numberOfLines={1}
              >
                {(() => {
                  const typingUsers = typingByConversation?.[String(convId)] ?? {};
                  const otherTyping = Object.keys(typingUsers).filter((u) => u !== currentUserId);
                  if (otherTyping.length > 0) return 'typing...';
                  return displayLastMessage || '';
                })()}
              </Text>
            </View>

            {/* RIGHT SIDE INFO */}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: palette.subtext }}>
                {(() => {
                  const raw = displayLastAt || '';
                  if (!raw) return '';
                  const dt = new Date(raw);
                  if (Number.isNaN(dt.getTime())) return String(raw);
                  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })()}
              </Text>

              {displayUnread > 0 && !isSelected && (
                <View
                  style={{
                    minWidth: 22,
                    paddingHorizontal: 6,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.primarySoft,
                  }}
                >
                  <Text
                    style={{
                      color: palette.primaryStrong,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {displayUnread}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
