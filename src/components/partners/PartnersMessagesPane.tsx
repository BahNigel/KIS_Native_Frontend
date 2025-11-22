// src/screens/tabs/PartnersMessagesPane.tsx
import React, { useMemo } from 'react';
import { Animated, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { Partner, PartnerGroup } from './partnersTypes';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';

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
  isMessagesExpanded, // kept for future, even if not used directly now
  toggleMessagesPane,
  selectedGroupId,
  groupsForPartner,
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

  const selectedGroupName =
    selectedGroup?.name ?? 'Select a group';

  // ✅ Build a minimal "chat" object for ChatRoomPage
  const chatForGroup = useMemo(
    () =>
      selectedGroup
        ? ({
            id: selectedGroup.id,
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
      {selectedGroupId && chatForGroup ? (
        // ✅ Use ChatRoomPage (with its own header) as the content of the sliding pane
        <ChatRoomPage
          chat={chatForGroup}
          onBack={toggleMessagesPane} // back = close pane in Partners section
          allChats={[]}               // you can pass real chats later
        />
      ) : (
        // Placeholder when no group is selected
        <View style={[styles.messagesBody, { paddingHorizontal: 10 }]}>
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
        </View>
      )}
    </Animated.View>
  );
}
