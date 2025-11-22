// src/screens/RegisterScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StatusBar,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  openSettings,
} from 'react-native-permissions';
import * as RNLocalize from 'react-native-localize';

// ✅ Use your provided post helper (no routes wrapper needed here)
import { postRequest } from '@/network/post/index';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';

type HeadersInit = Record<string, string>;

// ---------- THEME ----------
type Theme = {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
  primary: string;
  inputBg: string;
  inputText: string;
  placeholder: string;
};

const lightTheme: Theme = {
  isDark: false,
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f6f7f9',
  text: '#111111',
  textMuted: '#555555',
  border: '#dddddd',
  danger: '#d9534f',
  success: '#2ba84a',
  primary: '#1f6feb',
  inputBg: '#ffffff',
  inputText: '#111111',
  placeholder: '#777777',
};

const darkTheme: Theme = {
  isDark: true,
  bg: '#0b0b0c',
  surface: '#111216',
  surfaceAlt: '#17181c',
  text: '#f5f7fb',
  textMuted: '#a9b0bb',
  border: '#2a2d34',
  danger: '#ff6b6b',
  success: '#34d399',
  primary: '#8ab4ff',
  inputBg: '#15161a',
  inputText: '#f5f7fb',
  placeholder: '#88909b',
};

const useThemeTokens = () => {
  const scheme = useColorScheme(); // 'dark' | 'light' | null
  return scheme === 'dark' ? darkTheme : lightTheme;
};

// ---------- COUNTRY CODES ----------
const CALLING_CODE_BY_ISO: Record<string, string> = {
  // Africa (partial)
  CM: '+237', NG: '+234', GH: '+233', KE: '+254', ZA: '+27', CI: '+225',
  DZ: '+213', MA: '+212', TN: '+216', UG: '+256', RW: '+250', SN: '+221',
  NE: '+227', TD: '+235', GA: '+241', GQ: '+240',
  // Europe (partial)
  FR: '+33', DE: '+49', GB: '+44', IT: '+39', ES: '+34',
  // Americas (partial)
  US: '+1', CA: '+1', BR: '+55', MX: '+52',
  // Asia (partial)
  IN: '+91', CN: '+86', JP: '+81', KR: '+82',
  // Oceania (partial)
  AU: '+61', NZ: '+64',
};

async function reverseGeocodeISO(lat: number, lon: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=3&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KISApp/1.0 (register-screen)' },
    });
    const data = await res.json();
    const cc = data?.address?.country_code;
    return typeof cc === 'string' ? cc.toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

async function getLocationPermission(): Promise<boolean> {
  const perm =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
      : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

  let status = await check(perm);
  if (status === RESULTS.DENIED) status = await request(perm);
  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;

  if (status === RESULTS.BLOCKED) {
    Alert.alert(
      'Location Disabled',
      'Please enable location permission in Settings to auto-detect your country.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openSettings() },
      ]
    );
  }
  return false;
}

// ---------- STYLES ----------
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: t.bg },

    topBar: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    backIcon: { fontSize: 20, lineHeight: 20, color: t.text },
    backText: { fontSize: 16, fontWeight: '600', color: t.text },

    container: {
      padding: 20,
      gap: 20,
      flexGrow: 1,
      justifyContent: 'center',
      backgroundColor: t.bg,
    },
    passwordHint: {
      fontSize: 12,
      color: t.danger,
      marginTop: -6,
    },
    passwordReqTitle: {
      fontSize: 12,
      color: t.textMuted,
      marginBottom: 2,
    },
    passwordReqItem: {
      fontSize: 12,
      color: t.text,
    },
    reqGood: { color: t.success },
    reqBad: { color: t.danger },

    headerBlock: { gap: 6, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: t.text },
    subtitle: { fontSize: 14, color: t.textMuted },

    field: { gap: 8 },
    label: { fontSize: 14, color: t.text },

    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      fontSize: 16,
      backgroundColor: t.inputBg,
      color: t.inputText,
    },
    inputError: { borderColor: t.danger },

    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    prefixBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      borderRadius: 10,
    },
    prefixFlag: { fontWeight: '700', fontSize: 14, color: t.text },
    prefixCode: { fontSize: 16, color: t.text },
    phoneInput: { flex: 1 },

    readonly: { backgroundColor: t.surfaceAlt },
    readonlyText: { color: t.text, paddingVertical: 4 },

    privacy: { textAlign: 'center', fontSize: 12, color: t.textMuted },
  });

export default function RegisterScreen({ navigation }: any) {
  const theme = useThemeTokens();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // form fields
  const [displayName, setDisplayName] = useState('');
  const [regPhone, setRegPhone] = useState(''); // national digits only (no +code)
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');

  // geo / region
  const [countryISO, setCountryISO] = useState<string>('US');
  const [callingCode, setCallingCode] = useState<string>(CALLING_CODE_BY_ISO['US']);

  // ui
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const allowed = await getLocationPermission();
      if (allowed) {
        await new Promise<void>((resolve) => {
          Geolocation.getCurrentPosition(
            async (pos) => {
              if (cancelled) return resolve();
              const iso = await reverseGeocodeISO(pos.coords.latitude, pos.coords.longitude);
              if (!cancelled && iso) {
                setCountryISO(iso);
                setCallingCode(CALLING_CODE_BY_ISO[iso] ?? CALLING_CODE_BY_ISO['US']);
              }
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
          );
        });
      }
      if (!cancelled) {
        setCountryISO((prev) => {
          if (prev && prev !== 'US') return prev;
          const deviceRegion = RNLocalize.getCountry() || 'US';
          setCallingCode(CALLING_CODE_BY_ISO[deviceRegion] ?? CALLING_CODE_BY_ISO['US']);
          return deviceRegion;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // validators
  const passwordValid = (pwd: string) => {
    return (
      pwd.length >= 10 &&
      /[A-Z]/.test(pwd) &&   // contains uppercase
      /[a-z]/.test(pwd) &&   // contains lowercase
      /[0-9]/.test(pwd)      // contains number
    );
  };

  const phoneValid = useMemo(() => {
    const cleaned = regPhone.trim().replace(/[^\d]/g, '');
    return cleaned.length >= 6;
  }, [regPhone]);
  const passwordsMatch = regPassword.length > 0 && regPassword === regPassword2;

  const registerReady =
    phoneValid && passwordValid(regPassword) && passwordsMatch && !loading;

  const buildPhoneE164 = (national: string) =>
    `${callingCode}${national.replace(/[^\d]/g, '')}`;

  const persistTokensIfAny = async (payload: any) => {
    try {
      const d = payload?.data || payload || {};
      if (d?.access) await AsyncStorage.setItem('access_token', d.access);
      if (d?.refresh) await AsyncStorage.setItem('refresh_token', d.refresh);
    } catch {}
  };

  // Utility: cryptographically-strong 6-digit code
  const generateOtp = (len: number = 6) => {
    const digits = '0123456789';
    let code = '';
    if (globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(len);
      globalThis.crypto.getRandomValues(arr);
      for (let i = 0; i < len; i++) code += digits[arr[i] % 10];
    } else {
      for (let i = 0; i < len; i++) code += digits[Math.floor(Math.random() * 10)];
    }
    if (/^0+$/.test(code)) return generateOtp(len);
    return code;
  };

  const onRegister = async () => {
    try {
      setLoading(true);

      const phoneE164 = buildPhoneE164(regPhone);

      const payload: Record<string, any> = {
        phone: phoneE164,
        password: regPassword,
        password2: regPassword2,
        country: countryISO,
      };
      if (displayName.trim()) payload.display_name = displayName.trim();

      const res = await postRequest(ROUTES.auth.register, payload, {
        cacheKey: 'USER_KEY',
        cacheType: 'AUTH_CACHE',
        errorMessage: 'Unable to register.',
      });

      if (!res?.success) {
        const msg =
          res?.message ||
          res?.data?.message ||
          res?.data?.detail ||
          'Please review your details and try again.';
        return Alert.alert('Registration failed', msg);
      }

      await persistTokensIfAny(res);

      const user = res.data?.user || res.data || {};
      const isActive = user?.is_active ?? user?.status === 'active';

      if (isActive) {
        Alert.alert('Success', 'Account created and activated.');
        // e.g. navigation.replace('Home');
      }

      // Not active yet → generate OTP, ask backend to send SMS via Infobip, then go to verification
      const code = generateOtp(6);

      const otpInitRes = await postRequest(
        ROUTES.auth.otp,
        {
          phone: phoneE164,
          code,
          channel: 'sms',
          purpose: 'register',
        },
        { errorMessage: 'Unable to send verification code.' }
      );

      if (!otpInitRes?.success) {
        const msg =
          otpInitRes?.message ||
          otpInitRes?.data?.message ||
          otpInitRes?.data?.detail ||
          'We could not send your verification code. Please try again.';
        return Alert.alert('SMS failed', msg);
      }

      Alert.alert('Almost done', 'We sent you a verification code via SMS.');
      navigation.navigate('DeviceVerification', {
        phone: phoneE164,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected issue occurred.');
    } finally {
      setLoading(false);
    }
  };

  const PhonePrefix = () => (
    <View
      style={styles.prefixBox}
      accessible
      accessibilityLabel={`Country ${countryISO}, code ${callingCode}`}
    >
      <Text style={styles.prefixFlag}>{countryISO}</Text>
      <Text style={styles.prefixCode}>{callingCode}</Text>
    </View>
  );

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.replace?.('Welcome');
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Phone required; country auto-detected</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Display Name (optional)</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              placeholder="John Doe"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.phoneRow}>
              <PhonePrefix />
              <TextInput
                value={regPhone}
                onChangeText={setRegPhone}
                autoCapitalize="none"
                keyboardType="phone-pad"
                placeholder="6xx xxx xxx"
                placeholderTextColor={theme.placeholder}
                style={[
                  styles.input,
                  styles.phoneInput,
                  !!regPhone && !phoneValid && styles.inputError,
                ]}
                textContentType="telephoneNumber"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              placeholder="Choose a strong password"
              placeholderTextColor={theme.placeholder}
              style={[
                styles.input,
                !!regPassword && !passwordValid(regPassword) && styles.inputError,
              ]}
              textContentType="newPassword"
            />

            {/* Password Requirements */}
            <View style={{ marginTop: 4 }}>
              <Text style={styles.passwordReqTitle}>Password must include:</Text>
              <Text
                style={[
                  styles.passwordReqItem,
                  regPassword.length >= 10 ? styles.reqGood : styles.reqBad,
                ]}
              >
                • At least 10 characters
              </Text>
              <Text
                style={[
                  styles.passwordReqItem,
                  /[A-Z]/.test(regPassword) ? styles.reqGood : styles.reqBad,
                ]}
              >
                • One uppercase letter (A-Z)
              </Text>
              <Text
                style={[
                  styles.passwordReqItem,
                  /[a-z]/.test(regPassword) ? styles.reqGood : styles.reqBad,
                ]}
              >
                • One lowercase letter (a-z)
              </Text>
              <Text
                style={[
                  styles.passwordReqItem,
                  /[0-9]/.test(regPassword) ? styles.reqGood : styles.reqBad,
                ]}
              >
                • One number (0-9)
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              value={regPassword2}
              onChangeText={setRegPassword2}
              secureTextEntry
              placeholder="Re-enter password"
              placeholderTextColor={theme.placeholder}
              style={[
                styles.input,
                !!regPassword2 && regPassword2 !== regPassword && styles.inputError,
              ]}
              textContentType="newPassword"
            />
          </View>

          {/* Country is auto-detected; show read-only but you can make it editable if desired */}
          <View style={styles.field}>
            <Text style={styles.label}>Country</Text>
            <View style={[styles.input, styles.readonly]}>
              <Text style={styles.readonlyText}>{countryISO}</Text>
            </View>
          </View>

          <KISButton
            title={loading ? undefined : 'Create Account'}
            onPress={onRegister}
            disabled={!registerReady}
            variant="primary"
            size="md"
          >
            {loading ? <ActivityIndicator /> : null}
          </KISButton>

          <Text style={styles.privacy}>
            By creating an account, you agree to our Terms and Privacy Policy.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
