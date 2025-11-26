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

import {
  styles,
  type Chat,
  type CustomFilter,
  type QuickChip,
  applyQuickChips,
  applyCustomRules,
  bySearch,
} from '../messagesUtils';
import { normalizeConversation } from '../normalizeConversation';


type ChatsTabProps = {
  conversations: any[]; // raw backend conversations
  filters: CustomFilter[];
  activeQuick: Set<QuickChip>;
  activeCustomId?: string | null;
  search: string;

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
    return conversations.map((c) => normalizeConversation(c));
  }, [conversations]);

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
          if (selectionMode) {
            toggleSelectChat(item);
          } else {
            onOpenChat?.(item);
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
              <Text style={[styles.name, { color: palette.text }]}>
                {item.name}
              </Text>

              <Text
                style={{ color: palette.subtext }}
                numberOfLines={1}
              >
                {item.lastMessage || ''}
              </Text>
            </View>

            {/* RIGHT SIDE INFO */}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: palette.subtext }}>
                {item.lastAt || ''}
              </Text>

              {item.unreadCount > 0 && !isSelected && (
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
                    {item.unreadCount}
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
