// src/screens/tabs/profile/sheets/BottomSheet.tsx
import React from 'react';
import { Animated, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { styles } from '../profile.styles';

export default function BottomSheet({
  sheetY,
  children,
}: {
  sheetY: Animated.Value;
  children: React.ReactNode;
}) {
  const { palette } = useKISTheme();

  return (
    <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetY }] }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { backgroundColor: palette.bg }]}>
        <View style={{ flex: 1 }}>{children}</View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
