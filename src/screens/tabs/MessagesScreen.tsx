import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBar,
} from '@react-navigation/material-top-tabs';
import { useKISTheme } from '../../theme/useTheme';
import { KIS_TOKENS } from '../../theme/constants';
import { ChatsTab } from '@/Module/ChatRoom/componets/MessageTabs';
import { KISIcon } from '@/constants/kisIcons';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import { FilterManager, ToggleChip } from '@/Module/ChatRoom/componets/Filters';
import UpdatesTab from '@/Module/ChatRoom/componets/tabs/UpdatesTab';
import CallsTab from '@/Module/ChatRoom/componets/tabs/CallsTab';
import HubTab from '@/Module/ChatRoom/componets/tabs/HubTab';
import { 
  styles,
  type CustomFilter,
  type QuickChip,
  type Chat,
  CUSTOM_FILTERS_KEY 
} from '@/Module/ChatRoom/componets/messagesUtils';

const Tab = createMaterialTopTabNavigator();
type MessagesScreenProps = {
  onOpenChat?: (chat: Chat) => void;
};

/** Extend quick chips locally with Archived/Blocked without changing base type elsewhere */
type ExtraQuick = 'Archived' | 'Blocked';
type LocalQuick = QuickChip | ExtraQuick;

/**
 * Changes in this file focus on animation smoothness & robustness:
 * - Replace timing-based hide/show with a spring and a small state machine to avoid re-trigger thrash
 * - Add velocity-based heuristics when available and clamp spurious small scrolls
 * - Respect Reduced Motion accessibility (disables animations)
 * - Animate the overflow menu (fade + scale) instead of hard-mounting
 * - Avoid repeated setState on layout if height hasn't changed
 */
export default function MessagesScreen({ onOpenChat }: MessagesScreenProps) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Search & menus
  const [query, setQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // Quick chips incl. Archived/Blocked
  const [activeQuick, setActiveQuick] = useState<Set<LocalQuick>>(new Set());

  // Custom filters
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [activeCustom, setActiveCustom] = useState<string | null>(null);
  const [filterMgrOpen, setFilterMgrOpen] = useState(false);

  // ── Full-screen Chat Room overlay (covers entire device) ──────────────────
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const chatSlide = useRef(new Animated.Value(0)).current; // 0 = offscreen, 1 = onscreen
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat[]>([]);

// if you still want selectCount as separate state:
const [selectCount, setSelectCount] = useState<number | null>(null);

useEffect(() => {
  if (selectedChat.length > 0) {
    setSelectMode(true);
    setSelectCount(selectedChat.length);
  } else {
    setSelectMode(false);
    setSelectCount(null);
  }
}, [selectedChat]);

// handlers for app bar actions
const handleClearSelection = () => {
  setSelectedChat([]);
  setSelectMode(false);
  setMenuVisible(false);
};

const handleDeleteSelected = () => {
  // TODO: implement deletion logic
  // e.g. call API, update chats list, etc.
  console.log('Delete chats:', selectedChat);
};

const handlePinSelected = () => {
  console.log('Pin chats:', selectedChat);
};

const handleMuteSelected = () => {
  console.log('Mute chats:', selectedChat);
};



  const [addVisible, setAddVisible] = useState(false);
  const addSlide = useRef(new Animated.Value(0)).current; // 0 = off-screen, 1 = on-screen

  const openAddContacts = () => {
    setAddVisible(true);
    Animated.timing(addSlide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const closeChat = () => {
    Animated.timing(chatSlide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setChatVisible(false);
      setActiveChat(null);
    });
  };

  const closeAddContacts = () => {
    Animated.timing(addSlide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setAddVisible(false);
    });
  };

  const addTranslateY = addSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0], // slide up from bottom
  });

  const chatTranslateX = chatSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0], // slide in from the right
  });

  // ── Accessibility: reduce motion ──────────────────────────────────────────
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) reduceMotionRef.current = !!v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionRef.current = !!v;
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  // ── Animated cluster (header + tab bar) ───────────────────────────────────
  // hideProgress: 0 = fully shown, 1 = fully hidden
  const hideProgress = useRef(new Animated.Value(0)).current;

  // Header measurement
  const headerHRef = useRef(0);
  const [headerH, setHeaderH] = useState(0);

  // Tab bar measurement
  const tabHRef = useRef(0);
  const [tabH, setTabH] = useState(0);

  const onHeaderLayout = (e: LayoutChangeEvent) => {
    const h = Math.max(0, e.nativeEvent.layout.height || 0);
    if (h !== headerHRef.current) {
      headerHRef.current = h;
      setHeaderH(h);
    }
  };

  const onTabLayout = (h: number) => {
    const v = Math.max(0, h || 0);
    if (v !== tabHRef.current) {
      tabHRef.current = v;
      setTabH(v);
    }
  };

  const translateHeaderY = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(headerH * 2) || 0],
    extrapolate: 'clamp',
  });
  const headerNegMargin = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(headerH || 0)],
    extrapolate: 'clamp',
  });

  const translateTabY = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(tabH || 0)],
    extrapolate: 'clamp',
  });
  const tabNegMargin = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(tabH || 0)],
    extrapolate: 'clamp',
  });

  // ── Scroll heuristics (debounced + velocity aware) ────────────────────────
  const lastYRef = useRef(0);
  const lastTsRef = useRef(0);
  const animatingRef = useRef<null | 'show' | 'hide'>(null);

  const runSpring = useCallback(
    (toValue: 0 | 1) => {
      if (reduceMotionRef.current) {
        hideProgress.setValue(toValue);
        animatingRef.current = null;
        return;
      }
      animatingRef.current = toValue ? 'hide' : 'show';
      Animated.spring(hideProgress, {
        toValue,
        stiffness: 220,
        damping: 26,
        mass: 0.9,
        useNativeDriver: false, // we still animate layout margins
        // prevent tiny oscillations
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 0.5,
      }).start(() => {
        animatingRef.current = null;
      });
    },
    [hideProgress]
  );

  const animateHidden = (hidden: boolean) => {
    if (
      animatingRef.current &&
      ((hidden && animatingRef.current === 'hide') ||
        (!hidden && animatingRef.current === 'show'))
    ) {
      return; // avoid re-triggering same direction
    }
    runSpring(hidden ? 1 : 0);
  };

  const handleChatsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { y } = e.nativeEvent.contentOffset;
    const ts = Date.now();
    const dy = y - lastYRef.current;
    const dt = Math.max(1, ts - (lastTsRef.current || ts));
    const velocityY = dy / dt; // px per ms (rough)

    // Ignore ultra-small jitters/noise
    if (Math.abs(dy) < 2) return;

    // Velocity-sensitive thresholds (faster scrolls hide/show sooner)
    const baseThreshold = 8;
    const velocityBoost = Math.min(1.5, Math.max(0.5, Math.abs(velocityY) * 120));
    const threshold = baseThreshold / velocityBoost;

    if (dy > threshold) animateHidden(true); // scrolling down -> hide
    else if (dy < -threshold) animateHidden(false); // scrolling up -> show

    lastYRef.current = y;
    lastTsRef.current = ts;
  };

  const handleChatsEndReached = () => {
    animateHidden(false); // reveal at end
  };

  // ── Load/save custom filters ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CUSTOM_FILTERS_KEY);
        if (raw) setCustomFilters(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load custom filters', e);
      }
    })();
  }, []);
  async function persistFilters(next: CustomFilter[]) {
    setCustomFilters(next);
    try {
      await AsyncStorage.setItem(CUSTOM_FILTERS_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save custom filters', e);
    }
  }
  const addCustomFilter = (f: CustomFilter) => {
    const next = [...customFilters, f];
    persistFilters(next);
    setActiveCustom(f.id);
  };
  const deleteCustomFilter = (id: string) => {
    const next = customFilters.filter((f) => f.id !== id);
    persistFilters(next);
    if (activeCustom === id) setActiveCustom(null);
  };

  const quickToggle = (chip: LocalQuick) =>
    setActiveQuick((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });

  // pass only base chips to ChatsTab (Archived/Blocked UI-only until wired)
  const activeQuickForChats = useMemo(() => {
    const base = new Set<QuickChip>();
    for (const c of activeQuick)
      if (c === 'Unread' || c === 'Groups' || c === 'Mentions') base.add(c);
    return base;
  }, [activeQuick]);

  // ── Animated Top Tab Bar (collapses space) ───────────────────────────────
  const AnimatedTopBar = (tabProps: any) => {
    return (
      <Animated.View
        onLayout={(e) => onTabLayout(e.nativeEvent.layout.height)}
        style={{
          transform: [{ translateY: translateTabY }],
          marginBottom: tabNegMargin, // collapse layout space while hidden
          backgroundColor: palette.bar,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: palette.inputBorder,
        }}
      >
        <MaterialTopTabBar
          {...tabProps}
          style={{ backgroundColor: palette.bar, elevation: 0 }}
          indicatorStyle={{ backgroundColor: palette.primary, height: 3, borderRadius: 3 }}
          labelStyle={{ fontWeight: '700', textTransform: 'none', fontSize: 14 }}
          activeTintColor={palette.text}
          inactiveTintColor={palette.subtext}
        />
      </Animated.View>
    );
  };

  // ── Animated menu (fade + scale) ─────────────────────────────────────────
  const menuAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  useEffect(() => {
    const to = menuVisible ? 1 : 0;
    if (reduceMotionRef.current) {
      menuAnim.setValue(to);
    } else {
      Animated.timing(menuAnim, {
        toValue: to,
        duration: 140,
        easing: menuVisible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [menuVisible, menuAnim]);

  const menuStyle = {
    opacity: menuAnim,
    transform: [
      {
        scale: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-4, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  } as const;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.chrome, paddingTop: insets.top }]}>
      {/* ------------ Top App Bar ------------ */}
        {selectMode ? (
          // 🔵 SELECT MODE APP BAR
          <View
            style={[
              styles.appBar,
              { borderBottomColor: palette.inputBorder },
            ]}
          >
            {/* LEFT: back arrow + count */}
            <View style={styles.appBarLeft}>
              <Pressable
                onPress={handleClearSelection}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="arrow-left" size={20} color={palette.text} />
              </Pressable>

              <Text
                style={[
                  styles.appName,
                  { color: palette.text, marginLeft: 4 },
                ]}
              >
                {selectCount ?? selectedChat.length}
              </Text>
            </View>

            {/* RIGHT: pin, mute, delete, menu */}
            <View style={styles.appBarRight}>
              <Pressable
                onPress={handlePinSelected}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="pin" size={18} color={palette.text} />
              </Pressable>

              <Pressable
                onPress={handleMuteSelected}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="mute" size={18} color={palette.text} />
              </Pressable>

              <Pressable
                onPress={handleDeleteSelected}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="trash" size={18} color={palette.text} />
              </Pressable>

              <Pressable
                onPress={() => setMenuVisible((v) => !v)}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="menu" size={18} color={palette.text} />
              </Pressable>
            </View>

            {/* Dropdown menu (selection actions) */}
            <View pointerEvents={menuVisible ? 'auto' : 'none'} style={{ zIndex: 5 }}>
              {/* overlay */}
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={[styles.menuOverlay, { opacity: menuVisible ? 1 : 0 }]}
              />
              {/* popover */}
              <Animated.View
                style={[
                  styles.menuBox,
                  {
                    position: 'absolute',
                    right: 12,
                    top: Platform.select({ ios: 46, android: 50, default: 46 }),
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.card,
                    shadowColor: palette.shadow,
                  },
                  KIS_TOKENS.elevation.popover,
                  menuStyle,
                ]}
              >
                {[
                  { key: 'select-all', label: 'Select all' },
                  { key: 'mark-read', label: 'Mark as read' },
                  { key: 'archive', label: 'Archive' },
                ].map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => {
                      // TODO: handle each menu item
                      setMenuVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>
        ) : (
          // 🟢 NORMAL APP BAR (your original)
          <View
            style={[
              styles.appBar,
              { borderBottomColor: palette.inputBorder },
            ]}
          >
            <View style={styles.appBarLeft}>
              <Text style={[styles.appName, { color: palette.text }]}> KIS </Text>
              <Text style={[styles.appSubtitle, { color: palette.subtext }]}>
                Kingdom Impact Social
              </Text>
            </View>

            <View style={styles.appBarRight}>
              <Pressable
                onPress={() => {}}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="camera" size={18} color={palette.text} />
              </Pressable>
              <Pressable
                onPress={() => setMenuVisible((v) => !v)}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="menu" size={18} color={palette.text} />
              </Pressable>
            </View>

            {/* Dropdown menu (normal mode) */}
            <View pointerEvents={menuVisible ? 'auto' : 'none'} style={{ zIndex: 5 }}>
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={[styles.menuOverlay, { opacity: menuVisible ? 1 : 0 }]}
              />
              <Animated.View
                style={[
                  styles.menuBox,
                  {
                    position: 'absolute',
                    right: 12,
                    top: Platform.select({ ios: 46, android: 50, default: 46 }),
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.card,
                    shadowColor: palette.shadow,
                  },
                  KIS_TOKENS.elevation.popover,
                  menuStyle,
                ]}
              >
                {[
                  { key: 'new-chat', label: 'New chat' },
                  { key: 'new-group', label: 'New group' },
                  { key: 'settings', label: 'Settings' },
                ].map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setMenuVisible(false)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>
        )}


      {/* ------------ Animated Elevated Search Bar + Filters ------------ */}
      <Animated.View
        onLayout={onHeaderLayout}
        style={{
          transform: [{ translateY: translateHeaderY }],
          marginBottom: headerNegMargin, // collapse space so list moves up
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
          zIndex: 1,
        }}
      >
        <View
          style={[
            styles.searchContainer,
            {
              borderColor: palette.inputBorder,
              backgroundColor: palette.surfaceElevated,
              shadowColor: palette.shadow,
            },
            KIS_TOKENS.elevation.card,
          ]}
        >
          <KISIcon name="search" size={18} color={palette.text} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats, people, and groups…"
            placeholderTextColor={palette.subtext}
            style={[styles.searchInput, { color: palette.text }]}
          />
          <Pressable onPress={() => {}} style={styles.searchIconBtn}>
            <KISIcon name="mic" size={18} color={palette.text} />
          </Pressable>
          <View style={[styles.searchDivider, { backgroundColor: palette.inputBorder }]} />
          <Pressable onPress={() => setFilterMgrOpen(true)} style={styles.searchIconBtn} hitSlop={8}>
            <KISIcon name="settings" size={18} color={palette.text} />
          </Pressable>
        </View>

        {/* Quick chips + Custom filter row */}
        <View style={styles.chipsRow}>
          {(['Unread', 'Groups', 'Mentions', 'Archived', 'Blocked'] as LocalQuick[]).map(
            (chip) => (
              <ToggleChip
                key={chip}
                label={chip}
                active={activeQuick.has(chip)}
                onPress={() => quickToggle(chip)}
                palette={palette}
              />
            )
          )}

          {customFilters.map((f) => (
            <ToggleChip
              key={f.id}
              label={f.label}
              active={activeCustom === f.id}
              onPress={() => setActiveCustom((cur) => (cur === f.id ? null : f.id))}
              palette={palette}
            />
          ))}

          <Pressable
            onPress={() => setFilterMgrOpen(true)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: pressed ? palette.surface : palette.card,
                borderColor: palette.inputBorder,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              },
            ]}
          >
            <KISIcon name="add" size={18} color={palette.text} />
            <Text style={{ color: palette.text, fontSize: 13 }}>Create</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ------------ Top Tabs (animated tab bar) ------------ */}
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <Tab.Navigator
          tabBar={(props) => <AnimatedTopBar {...props} />}
          screenOptions={{ swipeEnabled: true, tabBarScrollEnabled: false }}
        >
          <Tab.Screen
            name="Chats"
            children={() => (
              <ChatsTab
                filters={customFilters}
                activeQuick={activeQuickForChats}
                activeCustomId={activeCustom}
                search={query}
                onScroll={handleChatsScroll}
                onEndReached={handleChatsEndReached}
                onOpenChat={onOpenChat}  // if you’re still using the chat room, keep this
                selectedChat={selectedChat}
                setSelectedChat={setSelectedChat}
              />
            )}
          />
          <Tab.Screen name="Updates" component={UpdatesTab} />
          <Tab.Screen name="Hub" component={HubTab} />
          <Tab.Screen name="Calls" component={CallsTab} />
        </Tab.Navigator>

        {/* 🔵 Suspended "Add" button (FAB) */}
        <Pressable
          onPress={openAddContacts}
          style={({ pressed }) => [
            {
              position: 'absolute',
              right: 16,
              bottom: 16 + 64, // 64-ish to sit above bottom tab bar
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.primary,
              shadowColor: palette.shadow,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            },
            pressed && { opacity: KIS_TOKENS.opacity.pressed },
          ]}
        >
          <KISIcon name="add" size={24} color={palette.inverseText ?? '#fff'} />
        </Pressable>
      </View>

      {/* Custom Filter Manager */}
      <FilterManager
        visible={filterMgrOpen}
        onClose={() => setFilterMgrOpen(false)}
        onSave={addCustomFilter}
        onDelete={deleteCustomFilter}
        filters={customFilters}
      />


      {/* ------------ Full-screen Chat Room Overlay ------------ */}
      {(
        <Animated.View
          pointerEvents={chatVisible ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateX: chatTranslateX }],
            zIndex: 50, // above everything
            backgroundColor: palette.bg,
          }}
        >
          <ChatRoomPage chat={activeChat} onBack={closeChat} />
        </Animated.View>
      )}
      {(
        <Animated.View
          pointerEvents={addVisible ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateY: addTranslateY }],
            zIndex: 40,
            backgroundColor: palette.bg,
          }}
        >
          <AddContactsPage onClose={closeAddContacts} />
        </Animated.View>
      )}
    </View>
  );
}