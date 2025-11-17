// src/screens/tabs/PartnersMessagesPane.tsx
import React from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { Partner, PartnerGroup } from './partnersTypes';

type Props = {
  width: number;
  messagesOffsetAnim: Animated.Value;
  isMessagesExpanded: boolean;
  toggleMessagesPane: () => void;
  selectedGroupId: string | null;
  groupsForPartner: PartnerGroup[];
  selectedPartner?: Partner;
};

export default function PartnersMessagesPane({
  width,
  messagesOffsetAnim,
  isMessagesExpanded,
  toggleMessagesPane,
  selectedGroupId,
  groupsForPartner,
  selectedPartner,
}: Props) {
  const { palette } = useKISTheme();

  const selectedGroupName =
    selectedGroupId
      ? groupsForPartner.find((g) => g.id === selectedGroupId)?.name || 'Select a group'
      : 'Select a group';

  return (
    <Animated.View
      style={[
        styles.messagesPane,
        {
          width,
          backgroundColor: palette.chatBg,
          borderLeftColor: palette.divider,
          transform: [{ translateX: messagesOffsetAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.messagesHeader,
          {
            backgroundColor: palette.chatHeaderBg,
            borderBottomColor: palette.divider,
          },
        ]}
      >
        <Pressable
          onPress={toggleMessagesPane}
          style={[
            styles.toggleButton,
            { backgroundColor: palette.surfaceElevated },
          ]}
        >
          <Text
            style={{
              color: palette.text,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            {isMessagesExpanded ? '›' : '‹'}
          </Text>
        </Pressable>

        <View style={styles.messagesTitleWrap}>
          <Text
            style={[
              styles.messagesTitle,
              { color: palette.text },
            ]}
            numberOfLines={1}
          >
            {selectedGroupName}
          </Text>
          {selectedPartner && (
            <Text
              style={[
                styles.messagesSubtitle,
                { color: palette.headerSubtext },
              ]}
              numberOfLines={1}
            >
              {selectedPartner.name}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.messagesBody, { paddingHorizontal: 10 }]}>
        {selectedGroupId ? (
          <>
            <Text
              style={[
                styles.messagesPlaceholderTitle,
                { color: palette.text },
              ]}
            >
              Messages area
            </Text>
            <Text
              style={[
                styles.messagesPlaceholderText,
                { color: palette.subtext },
              ]}
            >
              This will be the chat room for the selected group. It should
              show the full KIS chat UI once wired:
              {'\n'}• Message list{'\n'}• Composer (text, voice, stickers…)
              {'\n'}• Reactions, threads, etc.
            </Text>
          </>
        ) : (
          <>
            <Text
              style={[
                styles.messagesPlaceholderTitle,
                { color: palette.text },
              ]}
            >
              No group selected
            </Text>
            <Text
              style={[
                styles.messagesPlaceholderText,
                { color: palette.subtext },
              ]}
            >
              Choose a group on the center panel to open its room here.
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}
