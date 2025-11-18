// src/navigation/MainTabs.tsx
// ❌ No NavigationContainer here — only navigators and screens.

import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  useColorScheme,
  Animated as RNAnimated, // 👈 native Animated for overlay
} from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '../theme/useTheme';
import { KISIcon, KISIconName } from '@/constants/kisIcons';

import MessagesScreen from '../screens/tabs/MessagesScreen';
import PartnersScreen from '../screens/tabs/PartnersScreen';
import BibleScreen from '../screens/tabs/BibleScreen';
import BroadcastScreen from '../screens/tabs/BroadcastScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import { Chat } from '@/Module/ChatRoom/componets/messagesUtils';

type RouteKey = 'Partners' | 'Bible' | 'Messages' | 'Broadcast' | 'Profile';

const Tabs = createBottomTabNavigator();

const routeIconMap: Record<RouteKey, KISIconName> = {
  Partners: 'people',
  Bible: 'book',
  Messages: 'chat',
  Broadcast: 'megaphone',
  Profile: 'person',
};

// 👇 extend props to accept hidNav
type AnimatedKISTabBarProps = BottomTabBarProps & {
  hidNav: boolean;
};

function AnimatedKISTabBar({
  state,
  descriptors,
  navigation,
  hidNav,
}: AnimatedKISTabBarProps) {
  // 🔒 If hidNav is true, don’t render the bar at all
  if (hidNav) {
    return null;
  }

  // 🌓 Follow device theme
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const theme = useKISTheme();
  const { palette } = theme;

  React.useEffect(() => {
    // @ts-ignore
    if (typeof theme.setScheme === 'function') theme.setScheme(systemScheme ?? 'light');
    // @ts-ignore
    else if (typeof theme.setMode === 'function') theme.setMode(systemScheme ?? 'light');
    // @ts-ignore
    else if (typeof theme.useSystem === 'function') theme.useSystem();
  }, [systemScheme]);

  const insets = useSafeAreaInsets();

  const width = Dimensions.get('window').width;
  const count = state.routes.length;
  const tabWidth = width / count;

  const { palette: p } = theme;
  const focusedTextColor = p.text;
  const unfocusedTextColor = p.subtext;

  const barBg    = p.bar ?? p.surface;
  const cutoutBg = p.surface;

  const knobX = useSharedValue(state.index * tabWidth);
  React.useEffect(() => {
    knobX.value = withSpring(state.index * tabWidth, {
      damping: 18,
      stiffness: 220,
      mass: 0.55,
    });
  }, [state.index, tabWidth]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }));

  return (
    <View
      style={[
        styles.wrap,
        { padding: 6, backgroundColor: barBg, paddingBottom: Math.max(insets.bottom - 6, 0) },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: barBg,
            borderTopColor: 'transparent',
          },
        ]}
      >
        {/* Moving circular active bubble */}
        <Animated.View
          pointerEvents="none"
          style={[styles.knobWrap, { width: tabWidth }, knobStyle]}
        >
          <View style={[styles.knob, { backgroundColor: barBg }]}>
            <View
              style={{
                width: width,
                height: 22,
                borderBottomRightRadius: 22,
                backgroundColor: cutoutBg,
                position: 'absolute',
                top: 24,
                right: '97%',
                zIndex: 99,
              }}
            />
            <View
              style={{
                width: 80,
                height: 62,
                borderTopLeftRadius: 999,
                backgroundColor: barBg,
                position: 'absolute',
                top: 9,
                right: 24,
              }}
            />
            <View
              style={{
                width: width,
                height: 22,
                borderBottomLeftRadius: 22,
                backgroundColor: cutoutBg,
                position: 'absolute',
                top: 24,
                left: '97%',
                zIndex: 99,
              }}
            />
            <View
              style={{
                width: 80,
                height: 62,
                borderTopRightRadius: 999,
                backgroundColor: barBg,
                position: 'absolute',
                top: 9,
                left: 24,
              }}
            />
          </View>
        </Animated.View>

        {/* Tabs */}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;

          const progress = useSharedValue(focused ? 1 : 0);
          React.useEffect(() => {
            progress.value = withTiming(focused ? 1 : 0, { duration: 180 });
          }, [focused]);

          const iconA = useAnimatedStyle(() => ({
            transform: [
              { translateY: interpolate(progress.value, [0, 1], [0, -33]) },
              { scale: interpolate(progress.value, [0, 1], [1.15, 1.95]) },
            ],
          }));

          const textA = useAnimatedStyle(() => ({
            transform: [{ translateY: interpolate(progress.value, [1, 0], [-12, 0]) }],
          }));

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={[styles.tab, { width: tabWidth }]}>
              <Animated.View style={styles.tabInner}>
                <Animated.View style={iconA}>
                  <KISIcon
                    name={routeIconMap[route.name as RouteKey]}
                    size={24}
                    color={focused ? focusedTextColor : unfocusedTextColor}
                    focused={focused}
                  />
                </Animated.View>

                <Animated.Text
                  style={[
                    styles.label,
                    { color: focused ? focusedTextColor : unfocusedTextColor },
                    textA,
                  ]}
                >
                  {label}
                </Animated.Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MainTabs() {
  const { palette } = useKISTheme();
  const width = Dimensions.get('window').width;

  // 🔥 Chat room overlay state lives here so it can cover the bottom tabs
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const chatSlide = useRef(new RNAnimated.Value(0)).current; // 0 = off-screen, 1 = on-screen

  // 👇 control for hiding the nav bar (managed ONLY here)
  const [hidNav, setHidNav] = useState(false);

  const openChat = (chat: Chat) => {
    setActiveChat(chat);
    setChatVisible(true);

    RNAnimated.timing(chatSlide, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const closeChat = () => {
    RNAnimated.timing(chatSlide, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setChatVisible(false);
      setActiveChat(null);
    });
  };

  const chatTranslateX = chatSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0], // slide in from right
  });

  return (
    <View style={{ flex: 1 }}>
      <Tabs.Navigator
        initialRouteName="Messages"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
        // 👇 inject hidNav into custom tab bar
        tabBar={(p) => <AnimatedKISTabBar {...p} hidNav={hidNav} />}
      >
        {/* <Tabs.Screen
          name="Partners"
          component={PartnersScreen}
          options={{ title: 'Partners' }}
        /> */}

        <Tabs.Screen
          name="Partners"
          options={{ title: 'Partners' }}
        >
          {() => <PartnersScreen setHidNav={setHidNav} />}
        </Tabs.Screen>


        <Tabs.Screen
          name="Bible"
          component={BibleScreen}
          options={{ title: 'Bible' }}
        />

        <Tabs.Screen name="Messages" options={{ title: 'Messages' }}>
          {() => <MessagesScreen onOpenChat={openChat} />}
        </Tabs.Screen>

        <Tabs.Screen
          name="Broadcast"
          component={BroadcastScreen}
          options={{ title: 'Broadcast' }}
        />
        <Tabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
      </Tabs.Navigator>

      {/* 💥 Full-screen Chat Room overlay ABOVE tabs + bar */}
      <RNAnimated.View
        pointerEvents={chatVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: chatTranslateX }],
          zIndex: 999,
          backgroundColor: palette.bg,
        }}
      >
        <ChatRoomPage chat={activeChat} onBack={closeChat} />
      </RNAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 2 },
  bar: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  knobWrap: {
    position: 'absolute',
    top: -46,
    height: 64,
    alignItems: 'center',
  },
  knob: {
    width: 86,
    height: 86,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    shadowOpacity: 0,
    elevation: 0,
  },
  tab: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabInner: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: {
    fontSize: 11,
    fontWeight: Platform.select({ ios: '600', android: '700' }),
  },
});

export default MainTabs;
