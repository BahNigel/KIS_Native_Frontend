// src/screens/tabs/ProfileScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import KISButton from '../../constants/KISButton';
import { useKISTheme } from '../../theme/useTheme';
import { useAuth } from '../../../App'; // import from where you defined the context

export default function ProfileScreen() {
  const { palette } = useKISTheme();
  const { setAuth } = useAuth();

  const onLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      // TODO: if you have your own cache layer, clear it here too.
      setAuth(false); // <- this flips the root navigator back to Auth stack
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900', marginBottom: 20 }}>
        Profile
      </Text>
      <KISButton title="Log Out" onPress={onLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
});
