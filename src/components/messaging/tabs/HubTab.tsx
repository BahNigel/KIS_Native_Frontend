// src/screens/tabs/BroadcastScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useKISTheme } from '../../../theme/useTheme';

export default function HubTab() {
  const { palette } = useKISTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900' }}>Broadcast</Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, padding: 16 } });
