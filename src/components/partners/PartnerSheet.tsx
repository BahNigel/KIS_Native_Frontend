// src/screens/tabs/PartnerSheet.tsx
import React from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { Partner } from './partnersTypes';

type Props = {
  isOpen: boolean;
  sheetHeight: number;
  sheetOffsetAnim: Animated.Value;
  overlayOpacity: Animated.AnimatedInterpolation<string | number>;
  sheetPanHandlers: any;
  selectedPartner?: Partner;
  animatePartnerSheet: (open: boolean) => void;
};

export default function PartnerSheet({
  isOpen,
  sheetHeight,
  sheetOffsetAnim,
  overlayOpacity,
  sheetPanHandlers,
  selectedPartner,
  animatePartnerSheet,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View
      style={styles.sheetOverlay}
      pointerEvents={isOpen ? 'box-none' : 'none'}
    >
      {/* tappable space above the sheet to close it */}
      <Animated.View
        style={[
          styles.sheetBackdrop,
          { backgroundColor: palette.backdrop, opacity: overlayOpacity },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={() => animatePartnerSheet(false)} />
      </Animated.View>

      {/* draggable sheet itself */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: sheetHeight,
            backgroundColor: palette.surfaceElevated,
            borderTopColor: palette.divider,
            transform: [{ translateY: sheetOffsetAnim }],
          },
        ]}
        {...sheetPanHandlers}
      >
        <View
          style={[
            styles.sheetHandle,
            { backgroundColor: palette.borderMuted },
          ]}
        />
        <Text
          style={[
            styles.sheetTitle,
            { color: palette.text },
          ]}
        >
          {selectedPartner?.name} info
        </Text>
        <Text
          style={[
            styles.sheetSubtitle,
            { color: palette.subtext },
          ]}
        >
          Configure how you interact with this partner, view description,
          roles, and integration settings.
        </Text>

        <View style={styles.sheetSection}>
          <Text
            style={[
              styles.sheetSectionTitle,
              { color: palette.text },
            ]}
          >
            Overview
          </Text>
          <Text
            style={[
              styles.sheetSectionText,
              { color: palette.subtext },
            ]}
          >
            Tagline: {selectedPartner?.tagline}
          </Text>
          <Text
            style={[
              styles.sheetSectionText,
              { color: palette.subtext },
            ]}
          >
            Example fields:
            {'\n'}• Partner type (church, ministry, business)
            {'\n'}• Visibility (public / invite-only)
            {'\n'}• Your role (member, admin, steward)
          </Text>
        </View>

        <View style={styles.sheetSection}>
          <Text
            style={[
              styles.sheetSectionTitle,
              { color: palette.text },
            ]}
          >
            Notifications
          </Text>
          <Text
            style={[
              styles.sheetSectionText,
              { color: palette.subtext },
            ]}
          >
            Later you can add toggles like:
            {'\n'}• @mentions only
            {'\n'}• All messages
            {'\n'}• Mute this partner
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
