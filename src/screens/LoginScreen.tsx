// src/screens/LoginScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../theme/useTheme';
import KISButton from '../constants/KISButton';
import KISTextInput from '../constants/KISTextInput';
import KISText from '@/components/common/KISText';
import { postRequest } from '@/network/post/index';
import ROUTES from '@/network';
import { useAuth } from '../../App';
import { ensureDeviceId } from '@/security/e2ee';
import { KIS_TOKENS } from '@/theme/constants';

const CM_REGION = 'CM';
const CM_NATIONAL_MAX = 9;

const makeStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    root: {
      flex: 1,
      padding: tokens.spacing['2xl'],
      gap: tokens.spacing.lg,
    },
    backBtn: {
      marginBottom: tokens.spacing.sm,
      alignSelf: 'flex-start',
    },
    backTxt: {
      fontSize: tokens.typography.title,
      fontWeight: tokens.typography.weight.bold,
    },
    header: {
      fontSize: tokens.typography.h2,
      fontWeight: tokens.typography.weight.extrabold,
      marginTop: tokens.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: tokens.spacing.md,
      marginTop: tokens.spacing.xs,
    },
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
    },
    bottomCallout: {
      alignItems: 'center',
      marginTop: tokens.spacing['2xl'],
    },
    centerText: {
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: tokens.spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: tokens.radius.xl,
      padding: tokens.spacing.lg,
    },
    modalTitle: {
      fontSize: tokens.typography.h3,
      fontWeight: tokens.typography.weight.bold,
      marginBottom: tokens.spacing.sm,
    },
    modalRow: {
      marginTop: tokens.spacing.md,
      gap: tokens.spacing.lg,
    },
    link: {
      textDecorationLine: 'underline',
    },
  });

export default function LoginScreen({ navigation }: any) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const { setAuth, setPhone } = useAuth();

  const [phone, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

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
      const deviceId = await ensureDeviceId();
      const payload = {
        phone: phone.trim(),
        password,
        country: CM_REGION,
        device_id: deviceId,
        device_platform: Platform.OS,
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

  const forgotPhoneValid = useMemo(() => {
    if (!forgotPhone) return false;
    if (forgotPhone.startsWith('+')) {
      return forgotPhone.replace(/[^\d]/g, '').length >= 11;
    }
    return /^\d{9}$/.test(forgotPhone);
  }, [forgotPhone]);

  const requestResetCode = async () => {
    try {
      if (!forgotPhoneValid || forgotLoading) return;
      setForgotLoading(true);
      const payload = { phone: forgotPhone.trim(), channel: 'sms' };
      const res = await postRequest(ROUTES.auth.forgotPassword, payload, {
        errorMessage: 'Unable to send reset code.',
      });
      if (!res?.success) {
        const msg = res?.message || res?.data?.detail || 'Failed to send code.';
        return Alert.alert('Reset failed', msg);
      }
      setForgotStep('reset');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async () => {
    try {
      if (!forgotPhoneValid || !forgotCode || !forgotPassword || forgotLoading) return;
      setForgotLoading(true);
      const payload = {
        phone: forgotPhone.trim(),
        code: forgotCode.trim(),
        new_password: forgotPassword,
      };
      const res = await postRequest(ROUTES.auth.resetPassword, payload, {
        errorMessage: 'Unable to reset password.',
      });
      if (!res?.success) {
        const msg = res?.message || res?.data?.detail || 'Reset failed.';
        return Alert.alert('Reset failed', msg);
      }
      Alert.alert('Success', 'Password reset. Please log in.');
      setForgotVisible(false);
      setForgotStep('request');
      setForgotCode('');
      setForgotPassword('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
        <KISText preset="label" style={[styles.backTxt, { color: palette.text }]}>
          {Platform.OS === 'ios' ? '‹' : '←'} Back
        </KISText>
      </Pressable>

      <KISText preset="h2" color={palette.text} style={styles.header}>
        Log In
      </KISText>

      <View>
        <KISText preset="helper" color={palette.subtext}>
          Country
        </KISText>
        <KISText preset="title" color={palette.text}>
          CM
        </KISText>
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
        <View style={styles.inlineRow}>
          <Switch value={remember} onValueChange={setRemember} />
          <KISText preset="helper" color={palette.subtext}>
            Remember me
          </KISText>
        </View>
        <Pressable onPress={() => setForgotVisible(true)}>
          <KISText preset="helper" color={palette.subtext} style={styles.link}>
            Forgot password?
          </KISText>
        </Pressable>
      </View>

      <KISButton title={loading ? undefined : 'Log In'} onPress={onLogin} disabled={!canSubmit}>
        {loading ? <ActivityIndicator /> : null}
      </KISButton>

      <View style={styles.bottomCallout}>
        <KISText preset="helper" color={palette.subtext} style={styles.centerText}>
          Don’t have an account?{' '}
          <KISText
            preset="helper"
            color={palette.text}
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
          >
            Create one
          </KISText>
        </KISText>
      </View>

      <KISText preset="helper" color={palette.subtext} style={[styles.centerText, { marginTop: tokens.spacing['2xl'] }]}>
        2FA enabled
      </KISText>

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            <KISText preset="h3" color={palette.text} style={styles.modalTitle}>
              Reset password
            </KISText>
            <KISTextInput
              label="Phone (CM)"
              placeholder="e.g. 676139881 or +237676139881"
              autoCapitalize="none"
              keyboardType="phone-pad"
              value={forgotPhone}
              onChangeText={setForgotPhone}
              errorText={
                forgotPhone.length > 0 && !forgotPhoneValid
                  ? 'Enter a valid CM number (9 digits) or +237…'
                  : undefined
              }
            />
            {forgotStep === 'reset' ? (
              <>
                <KISTextInput
                  label="Code"
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  value={forgotCode}
                  onChangeText={setForgotCode}
                />
                <KISTextInput
                  label="New password"
                  placeholder="New password"
                  secureTextEntry
                  value={forgotPassword}
                  onChangeText={setForgotPassword}
                />
              </>
            ) : null}
            <View style={styles.modalRow}>
              <KISButton
                title={forgotLoading ? undefined : forgotStep === 'request' ? 'Send code' : 'Reset'}
                onPress={forgotStep === 'request' ? requestResetCode : resetPassword}
                disabled={forgotLoading || !forgotPhoneValid || (forgotStep === 'reset' && (!forgotCode || !forgotPassword))}
              >
                {forgotLoading ? <ActivityIndicator /> : null}
              </KISButton>
              <Pressable onPress={() => setForgotVisible(false)}>
                <KISText preset="helper" color={palette.subtext}>
                  Cancel
                </KISText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
