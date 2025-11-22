// src/screens/LoginScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../theme/useTheme';
import KISButton from '../constants/KISButton';
import KISTextInput from '../constants/KISTextInput';

import { postRequest } from '@/network/post/index';
import ROUTES from '@/network';
import { useAuth } from '../../App';

const CM_REGION = 'CM';
const CM_NATIONAL_MAX = 9; // Cameroon national digits length

export default function LoginScreen({ navigation }: any) {
  const { palette } = useKISTheme();
  const { setAuth, setPhone } = useAuth();

  const [phone, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  // Accept either national digits or +E.164. If national, enforce 0–9 digits (CM).
  const onChangePhone = useCallback((value: string) => {
    const v = (value || '').trim();

    if (v.startsWith('+')) {
      // Let backend normalize E.164; keep as-is but strip illegal chars
      const cleaned = v.replace(/[^\d+]/g, '');
      setPhoneInput(cleaned);
      return;
    }

    // National input (CM). Keep only digits and hard-cap to 9.
    const nat = v.replace(/\D/g, '').slice(0, CM_NATIONAL_MAX);
    setPhoneInput(nat);
  }, []);

  const phoneValid = useMemo(() => {
    if (!phone) return false;
    if (phone.startsWith('+')) {
      // '+2376…' — allow basic length check; backend does full validation
      return phone.replace(/[^\d]/g, '').length >= 11; // +237 + 9 digits = 12 chars incl '+'
    }
    // national digits for CM: 9 digits
    return /^\d{9}$/.test(phone);
  }, [phone]);

  const canSubmit = phoneValid && password.length > 0 && !loading;

  const persistAuth = async (data: any) => {
    const access = data?.access || data?.access_token;
    const refresh = data?.refresh || data?.refresh_token;
    if (access) await AsyncStorage.setItem('access_token', access);
    if (refresh) await AsyncStorage.setItem('refresh_token', refresh);

    // Save what the user typed (national or +E.164); optional
    if (remember && phone) {
      await AsyncStorage.setItem('user_phone', phone.trim());
      setPhone?.(phone.trim());
    } else {
      await AsyncStorage.removeItem('user_phone');
      setPhone?.(null);
    }
  };

  const onLogin = async () => {
    try {
      if (!canSubmit) return;
      setLoading(true);

      // Always send country: "CM", keep phone as typed (either 9 digits or +E.164)
      const payload = {
        phone: phone.trim(),
        password,
        country: CM_REGION,
      };

      const res = await postRequest(ROUTES.auth.login, payload, {
        errorMessage: 'Unable to log in.',
        cacheType: 'AUTH_CACHE',
        cacheKey: 'USER_KEY',
      });

      if (!res?.success) {
        const msg =
          res?.message ||
          res?.data?.message ||
          res?.data?.detail ||
          'Invalid phone or password.';
        return Alert.alert('Login failed', msg);
      }

      await persistAuth(res.data);
      setAuth(true); // App.tsx will switch to MainTabs
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error while logging in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* Back arrow */}
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
        <Text style={[styles.backTxt, { color: palette.text }]}>{Platform.OS === 'ios' ? '‹' : '←'} Back</Text>
      </Pressable>

      <Text style={[styles.header, { color: palette.text }]}>Log In</Text>

      {/* Country (fixed, non-editable) */}
      <View style={styles.countryRow}>
        <Text style={[styles.countryLabel, { color: palette.subtext }]}>Country</Text>
        <Text style={[styles.countryValue, { color: palette.text }]}>CM</Text>
      </View>

      <KISTextInput
        label="Phone (CM)"
        placeholder="e.g. 676139881 or +237676139881"
        autoCapitalize="none"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={onChangePhone}
        errorText={phone.length > 0 && !phoneValid ? 'Enter a valid CM number (9 digits) or +237…' : undefined}
      />

      <KISTextInput
        label="Password"
        placeholder="Your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Switch value={remember} onValueChange={setRemember} />
          <Text style={{ color: palette.subtext, marginLeft: 10 }}>Remember me</Text>
        </View>
        <Pressable onPress={() => Alert.alert('Forgot password', 'Coming soon.')}>
          <Text style={{ color: palette.subtext, textDecorationLine: 'underline' }}>Forgot password?</Text>
        </Pressable>
      </View>

      <KISButton title={loading ? undefined : 'Log In'} onPress={onLogin} disabled={!canSubmit}>
        {loading ? <ActivityIndicator /> : null}
      </KISButton>

      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <Text style={{ color: palette.subtext }}>
          Don’t have an account?{' '}
          <Text onPress={() => navigation.navigate('Register')} style={{ textDecorationLine: 'underline', color: palette.text }}>
            Create one
          </Text>
        </Text>
      </View>

      <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 24 }}>2FA enabled</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 12, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { fontSize: 16, fontWeight: '600' },

  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 8,
  },
  countryLabel: { fontSize: 14, fontWeight: '600' },
  countryValue: { fontSize: 14, fontWeight: '700' },
});
