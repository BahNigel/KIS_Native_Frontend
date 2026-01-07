// src/screens/tabs/PartnersMessagesPane.tsx
import React, { useMemo } from 'react';
import { Animated, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { Partner, PartnerCommunity, PartnerGroup } from './partnersTypes';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import PartnerFeedPage from './PartnerFeedPage';
import CommunityFeedPage from '@/Module/Community/CommunityFeedPage';

type Props = {
  width: number;
  messagesOffsetAnim: Animated.Value;
  isMessagesExpanded: boolean;
  toggleMessagesPane: () => void;
  selectedGroupId: string | null;
  selectedFeed: 'general' | null;
  groupsForPartner: PartnerGroup[];
  selectedCommunityFeedId: string | null;
  communitiesForPartner: PartnerCommunity[];
  selectedPartner?: Partner;
};

export default function PartnersMessagesPane({
  width,
  messagesOffsetAnim,
  isMessagesExpanded, // kept for future, even if not used directly now
  toggleMessagesPane,
  selectedGroupId,
  selectedFeed,
  groupsForPartner,
  selectedCommunityFeedId,
  communitiesForPartner,
  selectedPartner,
}: Props) {
  const { palette } = useKISTheme();

  const selectedGroup = useMemo(
    () =>
      selectedGroupId
        ? groupsForPartner.find((g) => g.id === selectedGroupId) || null
        : null,
    [selectedGroupId, groupsForPartner],
  );

  const selectedCommunity = useMemo(
    () =>
      selectedCommunityFeedId
        ? communitiesForPartner.find((c) => c.id === selectedCommunityFeedId) || null
        : null,
    [selectedCommunityFeedId, communitiesForPartner],
  );

  // ✅ Build a minimal "chat" object for ChatRoomPage
  const chatForGroup = useMemo(
    () =>
      selectedGroup
        ? ({
            id: selectedGroup.conversation_id ?? selectedGroup.id,
            conversationId: selectedGroup.conversation_id ?? selectedGroup.id,
            title: selectedGroup.name,
            name: selectedGroup.name,
            partnerId: selectedPartner?.id,
            partnerName: selectedPartner?.name,
          } as any)
        : null,
    [selectedGroup, selectedPartner],
  );

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
      {selectedFeed && selectedPartner ? (
        <PartnerFeedPage partner={selectedPartner} onBack={toggleMessagesPane} />
      ) : selectedCommunity ? (
        <CommunityFeedPage
          community={{ id: selectedCommunity.id, name: selectedCommunity.name }}
          onBack={toggleMessagesPane}
        />
      ) : selectedGroupId && chatForGroup ? (
        <ChatRoomPage
          chat={chatForGroup}
          onBack={toggleMessagesPane}
          allChats={[]}
        />
      ) : (
        <View style={[styles.messagesBody, { paddingHorizontal: 10 }]}>
          <Text
            style={[
              styles.messagesPlaceholderTitle,
              { color: palette.text },
            ]}
          >
            No destination selected
          </Text>
          <Text
            style={[
              styles.messagesPlaceholderText,
              { color: palette.subtext },
            ]}
          >
            Choose the partner feed or a group to open it here.
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
