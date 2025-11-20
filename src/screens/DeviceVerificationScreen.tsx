// src/screens/DeviceVerificationScreen.tsx
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type RouteParams = {
  phone?: string | null;   // <-- we expect phone passed from Register
  purpose?: 'register' | 'login';
};

export default function DeviceVerificationScreen({setLoad}:any) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params: RouteParams = route?.params || {};

  const [phone, setPhone] = useState<string>(params.phone || '');
  const [purpose] = useState<'register' | 'login'>(params.purpose || 'register');
  const [code, setCode] = useState('');
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  const onVerify = async () => {
    try {
      if (!phone.trim()) {
        return Alert.alert('Missing phone', 'We need your phone number to verify.');
      }
      if (!code.trim()) {
        return Alert.alert('Missing code', 'Please enter the verification code.');
      }
      setLoadingVerify(true);

      const res = await postRequest(
        ROUTES.auth.sendDeviceCode, // '/api/v1/auth/otp/verify/'
        { phone: phone.trim(), purpose, code: code.trim() },
        {
          cacheKey: 'DEVICE_CODE_VERIFY',
          cacheType: 'AUTH_CACHE',
          errorMessage: 'Verification failed.',
        }
      );

      if (!res?.success) {
        const msg = res?.message || 'Invalid or expired code.';
        return Alert.alert('Verification failed', msg);
      }

      Alert.alert('Verified', 'Your account is now activated.');
      // e.g. navigation.replace('MainTabs');
      setLoad(true)
      navigation.navigate('MainTabs')
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setLoadingVerify(false);
    }
  };

  // Optional: resend (only if user asks)
  const onResend = async () => {
    try {
      if (!phone.trim()) return Alert.alert('Missing phone', 'Enter your phone.');
      setLoadingResend(true);
      const r = await postRequest(
        ROUTES.auth.otp, // '/api/v1/auth/otp/initiate/'
        { phone: phone.trim(), purpose, channel: 'sms' },
        { errorMessage: 'Failed to resend code.' }
      );
      if (!r?.success) {
        const msg = r?.message || 'Please wait and try again.';
        return Alert.alert('Resend failed', msg);
      }
      Alert.alert('Code sent', `We sent a new code to ${phone}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setLoadingResend(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Verify your account</Text>
            <Text style={styles.subtitle}>We sent a 6-digit code to your phone.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone (read-only)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              editable={false}
              style={[styles.input, { opacity: 0.8 }]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              placeholder="Enter 6-digit code"
              style={styles.input}
              maxLength={6}
            />
          </View>

          <KISButton
            title={loadingVerify ? undefined : 'Verify & Activate'}
            onPress={onVerify}
            disabled={loadingVerify || !code.trim()}
            variant="primary"
            size="md"
          >
            {loadingVerify ? <ActivityIndicator /> : null}
          </KISButton>

          <View style={{ height: 12 }} />

          <KISButton
            title={loadingResend ? undefined : 'Resend Code'}
            onPress={onResend}
            disabled={loadingResend}
            variant="secondary"
            size="md"
          >
            {loadingResend ? <ActivityIndicator /> : null}
          </KISButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, gap: 20, flexGrow: 1, justifyContent: 'center' },
  headerBlock: { gap: 6, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#555' },
  field: { gap: 8 },
  label: { fontSize: 14, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 16, backgroundColor: '#fff',
  },
});
