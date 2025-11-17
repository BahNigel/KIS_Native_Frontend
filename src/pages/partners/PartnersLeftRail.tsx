// src/screens/tabs/PartnersLeftRail.tsx
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { LEFT_RAIL_WIDTH } from './partnersTypes';
import { MOCK_PARTNERS } from './partnersMockData';

type Props = {
  selectedPartnerId: string;
  onSelectPartner: (id: string) => void;
  onAddPartnerPress: () => void;
  onLogout: () => void;
};

export default function PartnersLeftRail({
  selectedPartnerId,
  onSelectPartner,
  onAddPartnerPress,
  onLogout,
}: Props) {
  const { palette } = useKISTheme();
  const selectedPartner = MOCK_PARTNERS.find((p) => p.id === selectedPartnerId) ?? MOCK_PARTNERS[0];

  return (
    <View
      style={[
        styles.leftRail,
        {
          width: LEFT_RAIL_WIDTH,
          backgroundColor: palette.chrome,
          borderRightColor: palette.divider,
        },
      ]}
    >
      <Pressable
        onPress={onAddPartnerPress}
        style={({ pressed }) => [
          styles.addPartnerButton,
          {
            backgroundColor: palette.primarySoft,
            borderColor: palette.borderMuted,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: palette.primaryStrong,
            fontSize: 28,
            lineHeight: 28,
            fontWeight: '900',
          }}
        >
          +
        </Text>
      </Pressable>

      <FlatList
        data={MOCK_PARTNERS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.partnerList}
        renderItem={({ item }) => {
          const isActive = item.id === selectedPartner?.id;
          return (
            <Pressable
              onPress={() => onSelectPartner(item.id)}
              style={({ pressed }) => [
                styles.partnerAvatarWrap,
                {
                  backgroundColor: isActive ? palette.primarySoft : palette.avatarBg,
                  borderColor: isActive ? palette.primaryStrong : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: isActive ? palette.primaryStrong : palette.onAvatar,
                  fontSize: 14,
                  fontWeight: '700',
                }}
              >
                {item.initials}
              </Text>
            </Pressable>
          );
        }}
      />

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Text style={{ color: palette.subtext, fontSize: 18 }}>⏏</Text>
      </Pressable>
    </View>
  );
}
