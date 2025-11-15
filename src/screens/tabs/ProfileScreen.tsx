// src/screens/tabs/ProfileScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '../../theme/useTheme';
import KISButton from '../../constants/KISButton';
import { postRequest } from '@/network/routes/post';
import ROUTES from '@/network/routes';
import { useAuth } from '../../../App';

export default function ProfileScreen() {
  const { palette } = useKISTheme();
  const { setAuth, setPhone } = useAuth();

  const logout = async () => {
    try {
      const server = await postRequest(ROUTES.auth.logout, {}, { errorMessage: 'Server logout failed.' });
      if (!server?.success) console.log('Logout POST did not succeed:', server?.message);

      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_phone']);
      setPhone?.(null);
      setAuth(false);
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900', marginBottom: 20 }}>
        Profile
      </Text>
      <KISButton title="Log Out" onPress={logout} />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { flex: 1, padding: 16 }});
