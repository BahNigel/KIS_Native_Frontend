// App.tsx
import React, { useEffect, useMemo, useState, createContext, useContext } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Alert, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DeviceVerificationScreen from './src/screens/DeviceVerificationScreen';
import { MainTabs } from '@/navigation/AppNavigator';
import { getRequest } from '@/network/routes/get';
import ROUTES from '@/network/routes';

type AuthCtx = {
  isAuth: boolean;
  setAuth: (b: boolean) => void;
  setPhone?: (p: string | null) => void; // if ProfileScreen consumes this
};
const AuthContext = createContext<AuthCtx>({ isAuth: false, setAuth: () => {} });
export const useAuth = () => useContext(AuthContext);

type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  DeviceVerification: undefined;
  MainTabs: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  const [booting, setBooting] = useState(true);
  const [isAuth, setAuth] = useState(false);
  const [load, setLoad] = useState(false); // trigger from DeviceVerification
  const [phone, setPhone] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const storedPhone = await AsyncStorage.getItem('user_phone');
      setPhone(storedPhone);

      
      if (token) {
        const qs = storedPhone ? `?phone=${encodeURIComponent(storedPhone)}` : '';
        const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
          errorMessage: 'Status check failed.',
          cacheType: 'AUTH_CACHE',
        });

        // Accept either `user.is_active`/`user.status` or top-level `is_active`/`status`
        const u = res?.data?.user ?? res?.data ?? {};
        const active = res?.success && (u.is_active || u.status === 'active');
        setAuth(Boolean(active));
      } else {
        setAuth(false);
      }
    } catch (e: any) {
      console.log('[checkAuth] error:', e?.message);
      setAuth(false);
    } finally {
      setBooting(false);
    }
  };

  // Only on mount and whenever `load` changes
  useEffect(() => {
    (async () => {
      await checkAuth();
    })();
  }, [load]);

  useEffect(() => {
    console.log('isAuth ->', isAuth);
  }, [isAuth]);

  const ctx = useMemo(() => ({ isAuth, setAuth, setPhone }), [isAuth]);

  if (booting) {
    return <SplashScreen />;
  }

  return (
    <AuthContext.Provider value={ctx}>
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {isAuth ? (
            <RootStack.Screen name="MainTabs" component={MainTabs} />
          ) : (
            <>
              <RootStack.Screen name="Welcome" component={WelcomeScreen} />
              <RootStack.Screen name="Login" component={LoginScreen} />
              <RootStack.Screen name="Register" component={RegisterScreen} />
              <RootStack.Screen name="DeviceVerification">
                {(props) => <DeviceVerificationScreen {...props} setLoad={setLoad} />}
              </RootStack.Screen>
            </>
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
