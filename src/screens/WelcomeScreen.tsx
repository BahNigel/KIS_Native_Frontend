// src/screens/WelcomeScreen.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Linking,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../theme/useTheme';
import KISButton from '../constants/KISButton';

// theme-aware hero illustrations (light/dark)
import avatarsLight from '../assets/welcom_light.png';
import avatarsDark from '../assets/welcom_dark.png';

// NEW: reuse your server-side auth check
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
// NEW: consume app-wide auth context (optional but nice to keep in sync)
import { useAuth } from '../../App';

const PRIVACY_URL = 'https://christiancommunit.netlify.app';

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { palette, tone } = useKISTheme();
  const { setAuth, setPhone } = useAuth(); // keep global auth in sync if we auto-redirect
  const fade = useRef(new Animated.Value(0)).current;
  const pressing = useRef(false);
  const { width, height } = useWindowDimensions();

  const heroSource = tone === 'dark' ? avatarsDark : avatarsLight;

  // fade animation on theme switch
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [tone, fade]);

  // Adjust hero image size scaling here:
  // 0.75 = scale factor (higher = bigger), 200 = minimum, 520 = maximum.
  const HERO_SCALE = 0.75;   // increase or decrease to resize globally
  const HERO_MIN = 200;      // minimum displayed size
  const HERO_MAX = 520;      // maximum displayed size

  const heroSize = Math.max(HERO_MIN, Math.min(HERO_MAX, Math.round(width * HERO_SCALE)));

  const goMain = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }, [navigation]);

  const handleContinueAsGuest = useCallback(() => {
    if (pressing.current) return;
    pressing.current = true;
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { guest: true } }] });
    setTimeout(() => (pressing.current = false), 600);
  }, [navigation]);

  const openExternal = useCallback(() => {
    Linking.openURL(PRIVACY_URL).catch(() => {});
  }, []);

  // NEW: check if logged in and redirect if so
  const checkAndRedirectIfLoggedIn = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const storedPhone = await AsyncStorage.getItem('user_phone');
      if (storedPhone) setPhone?.(storedPhone);

      if (!token) return; // not logged in locally

      const qs = storedPhone ? `?phone=${encodeURIComponent(storedPhone)}` : '';
      const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
        errorMessage: 'Status check failed.',
        cacheType: 'AUTH_CACHE',
      });

      const u = res?.data?.user ?? res?.data ?? {};
      const active = res?.success && (u.is_active || u.status === 'active');

      if (active) {
        setAuth?.(true);         // sync global state
        goMain();                // redirect
      } else {
        setAuth?.(false);
      }
    } catch {
      // swallow — stay on Welcome if anything fails
      setAuth?.(false);
    }
  }, [goMain, setAuth, setPhone]);

  // Run once on mount
  useEffect(() => {
    checkAndRedirectIfLoggedIn();
  }, [checkAndRedirectIfLoggedIn]);

  // Also run whenever the screen regains focus (e.g., after logout/login elsewhere)
  useFocusEffect(
    useCallback(() => {
      checkAndRedirectIfLoggedIn();
    }, [checkAndRedirectIfLoggedIn])
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: 24, paddingVertical: 32, minHeight: height },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces
      >
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, width: '100%', maxWidth: 720, alignSelf: 'center' },
          ]}
        >
          <Animated.Image
            source={heroSource}
            resizeMode="contain"
            style={[
              styles.hero,
              {
                width: heroSize,
                height: heroSize,
                opacity: fade,
                backgroundColor: tone === 'dark' ? '#0F0D14' : '#FFFFFF',
              },
            ]}
          />

          <Text style={[styles.title, { color: palette.text }]}>Welcome to KIS</Text>

          <Text style={[styles.subtitle, { color: palette.subtext, padding: 15 }]}>
            A space for believers to connect, grow, learn, and support one another.
            Built for today’s world — rooted in faith, guided by purpose, and strengthened in community.
          </Text>

          <KISButton
            title="Create Account"
            onPress={() => navigation.navigate('Register')}
            style={{ marginTop: 24, width: '100%' }}
          />
          <KISButton
            title="Log In"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: 12, width: '100%' }}
          />

          <Pressable onPress={handleContinueAsGuest} style={{ marginTop: 18, paddingVertical: 8 }} hitSlop={8}>
            <Text style={{ color: palette.subtext, textDecorationLine: 'underline' }}>Continue as guest</Text>
          </Pressable>

          <Text style={[styles.legal, { color: palette.subtext }]}>
            KIS | 2026 · <Text style={[styles.link, { color: '#FF8A33' }]} onPress={openExternal}>Privacy</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },
  hero: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 500, paddingHorizontal: 8 },
  legal: { textAlign: 'center', marginTop: 18, fontSize: 12 },
  link: { fontWeight: '700' },
});
