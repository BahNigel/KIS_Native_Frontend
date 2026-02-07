// App.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
} from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DeviceVerificationScreen from './src/screens/DeviceVerificationScreen';
import { MainTabs } from '@/navigation/AppNavigator';
import ProfileInsightsScreen from './src/screens/insights/ProfileInsightsScreen';
import PartnerInsightsScreen from './src/screens/insights/PartnerInsightsScreen';
import AdminToolsScreen from './src/screens/insights/AdminToolsScreen';
import AdminDashboardScreen from './src/screens/insights/AdminDashboardScreen';
import AnalyticsDashboardScreen from './src/screens/insights/AnalyticsDashboardScreen';
import EventsDashboardScreen from './src/screens/insights/EventsDashboardScreen';
import ContentDashboardScreen from './src/screens/insights/ContentDashboardScreen';
import SurveysDashboardScreen from './src/screens/insights/SurveysDashboardScreen';
import MediaDashboardScreen from './src/screens/insights/MediaDashboardScreen';
import BridgeDashboardScreen from './src/screens/insights/BridgeDashboardScreen';
import TiersDashboardScreen from './src/screens/insights/TiersDashboardScreen';
import NotificationsDashboardScreen from './src/screens/insights/NotificationsDashboardScreen';
import OrganizationAppScreen from './src/screens/partners/OrganizationAppScreen';
import OrganizationAppFormScreen from './src/screens/partners/OrganizationAppFormScreen';
import { getRequest } from '@/network/get';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { postRequest } from '@/network/post';
import { SocketProvider } from '@/SocketProvider';
import { initPushHandlers } from './src/push/notifications';

type AuthCtx = {
  isAuth: boolean;
  setAuth: (b: boolean) => void;
  setPhone?: (p: string | null) => void;
};
const AuthContext = createContext<AuthCtx>({ isAuth: false, setAuth: () => {} });
export const useAuth = () => useContext(AuthContext);

const RootStack = createNativeStackNavigator();

export default function App() {
  const scheme = useColorScheme();
  const [booting, setBooting] = useState(true);

  const [isAuth, setAuth] = useState(false);
  const [load, setLoad] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const storedPhone = await AsyncStorage.getItem('user_phone');

      console.log('checking login (token, phone):', token, storedPhone);

      setPhone(storedPhone);

      if (!token) {
        setAuth(false);
        return;
      }

      try {
        const qs = storedPhone ? `?phone=${encodeURIComponent(storedPhone)}` : '';
        const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
          errorMessage: 'Status check failed.',
          cacheType: 'AUTH_CACHE',
        });

        console.log('checkLogin response:', res);

        const u = res?.data?.user ?? res?.data ?? {};
        const active = res?.success && (u.is_active || u.status === 'active');
        console.log('active from backend:', active);

        if (active) {
          setAuth(true);
        } else if (res?.success === false && res?.message === 'No internet connection.') {
          console.log('Offline but token exists — trusting local auth.');
          setAuth(true);
        } else {
          setAuth(false);
        }
      } catch (networkErr: any) {
        console.log('[checkAuth] network error:', networkErr?.message);
        setAuth(true);
      }
    } catch (e: any) {
      console.log('[checkAuth] outer error:', e?.message);
      setAuth(false);
    }
  };

  useEffect(() => {
    (async () => {
      // ⏳ Force splash screen for minimum 5 seconds
      await Promise.all([
        checkAuth(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      setBooting(false);
    })();
  }, [load]);

  useEffect(() => {
    console.log('isAuth ->', isAuth);
  }, [isAuth]);

  useEffect(() => {
    initPushHandlers();
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    let active = true;

    const registerPushToken = async () => {
      try {
        const token = await AsyncStorage.getItem('push_token');
        const fallbackToken = await AsyncStorage.getItem('fcm_token');
        const apnsToken = await AsyncStorage.getItem('apns_token');
        const deviceId = await AsyncStorage.getItem('device_id');
        const finalToken = token || fallbackToken;

        if (!active) return;

        if (Platform.OS === 'ios' && apnsToken) {
          await postRequest(`${NEST_API_BASE_URL}/notifications/tokens/register`, {
            token: apnsToken,
            platform: 'ios',
            deviceId: deviceId ?? undefined,
          });
        }

        if (finalToken) {
          await postRequest(`${NEST_API_BASE_URL}/notifications/tokens/register`, {
            token: finalToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            deviceId: deviceId ?? undefined,
          });
        }
      } catch (e: any) {
        console.log('[push-token] register failed:', e?.message);
      }
    };

    registerPushToken();

    return () => {
      active = false;
    };
  }, [isAuth]);

  const ctx = useMemo(
    () => ({ isAuth, setAuth, setPhone }),
    [isAuth],
  );

  if (booting) {
    return <SplashScreen />;
  }

  return (
    <AuthContext.Provider value={ctx}>
      <SocketProvider>
        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {isAuth ? (
              <>
                <RootStack.Screen name="MainTabs" component={MainTabs} />
                <RootStack.Screen
                  name="ProfileInsights"
                  component={ProfileInsightsScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="PartnerInsights"
                  component={PartnerInsightsScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="OrganizationApp"
                  component={OrganizationAppScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="OrganizationAppForm"
                  component={OrganizationAppFormScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="AdminTools"
                  component={AdminToolsScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="AnalyticsDashboard"
                  component={AnalyticsDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="EventsDashboard"
                  component={EventsDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="ContentDashboard"
                  component={ContentDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="SurveysDashboard"
                  component={SurveysDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="MediaDashboard"
                  component={MediaDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="BridgeDashboard"
                  component={BridgeDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="TiersDashboard"
                  component={TiersDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="NotificationsDashboard"
                  component={NotificationsDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="AdminDashboard"
                  component={AdminDashboardScreen}
                  options={{ presentation: 'modal' }}
                />
              </>
            ) : (
              <>
                <RootStack.Screen name="Welcome" component={WelcomeScreen} />
                <RootStack.Screen name="Login" component={LoginScreen} />
                <RootStack.Screen name="Register" component={RegisterScreen} />
                <RootStack.Screen name="DeviceVerification">
                  {(props) => (
                    <DeviceVerificationScreen {...props} setLoad={setLoad} />
                  )}
                </RootStack.Screen>
              </>
            )}
          </RootStack.Navigator>
        </NavigationContainer>
      </SocketProvider>
    </AuthContext.Provider>
  );
}
