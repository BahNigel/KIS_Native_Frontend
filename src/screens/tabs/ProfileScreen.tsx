// src/screens/tabs/ProfileScreen.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../../theme/useTheme';
import KISButton from '../../constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { useAuth } from '../../../App';
import PartnerCreateSlide from '@/components/partners/CreatePartnerScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const { palette } = useKISTheme();
  const { setAuth, setPhone } = useAuth();

  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const slideX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const logout = async () => {
    try {
      const server = await postRequest(ROUTES.auth.logout, {}, {
        errorMessage: 'Server logout failed.',
      });

      if (!server?.success) console.log(server?.message);

      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_phone']);
      setPhone?.(null);
      setAuth(false);
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  const openCreatePartner = () => {
    setShowCreatePartner(true);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeCreatePartner = () => {
    Animated.timing(slideX, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCreatePartner(false);
    });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900', marginBottom: 20 }}>
        Profile
      </Text>

      <View style={{ gap: 12 }}>
        <KISButton title="Create Partner" onPress={openCreatePartner} />
        <KISButton title="Log Out" onPress={logout} />
      </View>

      {/* Slide-in Page */}
      {showCreatePartner && (
        <Animated.View
          style={[
            styles.slideContainer,
            { backgroundColor: palette.bg, transform: [{ translateX: slideX }] }
          ]}
        >
          <PartnerCreateSlide onClose={closeCreatePartner} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 16,
  },
  slideContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    right: 0,
    elevation: 25,
    zIndex: 99,
  },
});
