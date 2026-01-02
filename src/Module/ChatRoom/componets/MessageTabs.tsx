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
    return normalizedChats.filter(
      (c: Chat) =>
        applyQuickChips(c, activeQuick) &&
        applyCustomRules(c, customRules) &&
        bySearch(c, search)
    );
  }, [normalizedChats, activeQuick, customRules, search]);

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
                  const convId = (item as any).conversationId ?? item.id;
                  const typingUsers = typingByConversation?.[String(convId)] ?? {};
                  const otherTyping = Object.keys(typingUsers).filter((u) => u !== currentUserId);
                  if (otherTyping.length > 0) return 'typing...';
                  return (conversationMeta?.[String(convId)]?.lastMessage ?? item.lastMessage) || '';
                })()}
              </Text>
            </View>

            {/* RIGHT SIDE INFO */}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: palette.subtext }}>
                {(() => {
                  const raw = (conversationMeta?.[String((item as any).conversationId ?? item.id)]?.lastAt ?? item.lastAt) || '';
                  if (!raw) return '';
                  const dt = new Date(raw);
                  if (Number.isNaN(dt.getTime())) return String(raw);
                  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })()}
              </Text>

              {(conversationMeta?.[String((item as any).conversationId ?? item.id)]?.unreadCount ?? item.unreadCount) > 0 && !isSelected && (
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
                    {conversationMeta?.[String((item as any).conversationId ?? item.id)]?.unreadCount ?? item.unreadCount}
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
