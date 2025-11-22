// src/screens/tabs/PartnersScreen.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  Alert,
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useKISTheme } from '../../theme/useTheme';
import { useAuth } from '../../../App';
import { MOCK_COMMUNITIES, MOCK_GROUPS, MOCK_PARTNERS } from '@/components/partners/partnersMockData';
import { Partner, PartnerCommunity, PartnerGroup, RIGHT_PEEK_WIDTH } from '@/components/partners/partnersTypes';
import styles from '@/components/partners/partnersStyles';
import PartnersLeftRail from '@/components/partners/PartnersLeftRail';
import PartnersCenterPane from '@/components/partners/PartnersCenterPane';
import PartnersMessagesPane from '@/components/partners/PartnersMessagesPane';
import PartnerSheet from '@/components/partners/PartnerSheet';
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function PartnersScreen({ setHidNav }: any) {
  const navigation = useNavigation<any>();
  const { palette } = useKISTheme();
  const { setAuth } = useAuth();
  const { width, height } = useWindowDimensions();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    MOCK_PARTNERS[0]?.id,
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);

  // Bottom sheet open/closed
  const [isPartnerSheetOpen, setIsPartnerSheetOpen] = useState(false);

  // Track which communities are expanded
  const [expandedCommunities, setExpandedCommunities] = useState<
    Record<string, boolean>
  >({});

  // RIGHT messages pane: minimized => peek only
  const minimizedOffset = width - RIGHT_PEEK_WIDTH;

  // Partner sheet height (approx 70% of screen, capped)
  const sheetHeight = Math.min(height * 0.7, 520);

  // RIGHT pane animation: 0=open, minimizedOffset=peek
  const messagesOffsetAnim = useRef(new Animated.Value(minimizedOffset)).current;
  const offsetRef = useRef(minimizedOffset);
  const dragStartOffsetRef = useRef(minimizedOffset);

  // BOTTOM SHEET animation: 0=open, sheetHeight=off-screen (closed)
  const sheetOffsetAnim = useRef(new Animated.Value(sheetHeight)).current;
  const sheetOffsetRef = useRef(sheetHeight);
  const sheetDragStartRef = useRef(sheetHeight);

  // 🔽 When leaving PartnersScreen, always restore the tab bar
  useFocusEffect(
    useCallback(() => {
      return () => {
        const parent = navigation.getParent();
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation]),
  );

  // keep offsetRef in sync with messagesOffsetAnim
  useEffect(() => {
    const id = messagesOffsetAnim.addListener(({ value }) => {
      offsetRef.current = value;
    });
    return () => {
      messagesOffsetAnim.removeListener(id);
    };
  }, [messagesOffsetAnim]);

  // Reposition messages pane on width change
  useEffect(() => {
    const target = isMessagesExpanded ? 0 : minimizedOffset;
    messagesOffsetAnim.setValue(target);
    offsetRef.current = target;
  }, [width, minimizedOffset, isMessagesExpanded, messagesOffsetAnim]);

  // keep sheetOffsetRef in sync
  useEffect(() => {
    const id = sheetOffsetAnim.addListener(({ value }) => {
      sheetOffsetRef.current = value;
    });
    return () => {
      sheetOffsetAnim.removeListener(id);
    };
  }, [sheetOffsetAnim]);

  // Keep sheet sensible if height changes
  useEffect(() => {
    const target = isPartnerSheetOpen ? 0 : sheetHeight;
    sheetOffsetAnim.setValue(target);
    sheetOffsetRef.current = target;
  }, [sheetHeight, isPartnerSheetOpen, sheetOffsetAnim]);

  const overlayOpacity = sheetOffsetAnim.interpolate({
    inputRange: [0, sheetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const selectedPartner: Partner = useMemo(
    () => MOCK_PARTNERS.find((p) => p.id === selectedPartnerId) ?? MOCK_PARTNERS[0],
    [selectedPartnerId],
  );

  const groupsForPartner: PartnerGroup[] = useMemo(
    () => MOCK_GROUPS.filter((g) => g.partnerId === selectedPartner?.id),
    [selectedPartner?.id],
  );

  const communitiesForPartner: PartnerCommunity[] = useMemo(
    () => MOCK_COMMUNITIES.filter((c) => c.partnerId === selectedPartner?.id),
    [selectedPartner?.id],
  );

  const rootGroups: PartnerGroup[] = useMemo(
    () => groupsForPartner.filter((g) => !g.communityId),
    [groupsForPartner],
  );

  // Reset expanded communities when partner changes
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    communitiesForPartner.forEach((c) => {
      initial[c.id] = true; // default expanded
    });
    setExpandedCommunities(initial);
  }, [selectedPartnerId, communitiesForPartner.length]);

  const onLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      setAuth(false);
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  const animateMessagesPane = (expand: boolean) => {
    setIsMessagesExpanded(expand);

    Animated.timing(messagesOffsetAnim, {
      toValue: expand ? 0 : minimizedOffset,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      // ✅ Only toggle nav AFTER pane has fully opened/closed
      setHidNav?.(expand);
    });
  };

  const toggleMessagesPane = () => {
    animateMessagesPane(!isMessagesExpanded);
  };

  const animatePartnerSheet = (open: boolean) => {
    setIsPartnerSheetOpen(open);
    Animated.timing(sheetOffsetAnim, {
      toValue: open ? 0 : sheetHeight,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const onAddPartnerPress = () => {
    Alert.alert(
      'Add partner',
      'Here you will open a slide-in page with the list of partners to join/apply.',
    );
  };

  const onGroupPress = (groupId: string) => {
    setSelectedGroupId(groupId);
    // ❌ no direct setHidNav here – handled by animation completion
    if (!isMessagesExpanded) {
      animateMessagesPane(true);
    }
  };

  const toggleCommunity = (communityId: string) => {
    setExpandedCommunities((prev) => ({
      ...prev,
      [communityId]: !(prev[communityId] ?? true),
    }));
  };

  // helper to snap messages pane to nearest state (open/closed)
  const snapMessagesPaneToNearest = () => {
    const currentOffset = offsetRef.current;
    const halfway = minimizedOffset / 2;
    const shouldOpen = currentOffset < halfway;
    animateMessagesPane(shouldOpen);
  };

  // Swipe gesture for RIGHT messages pane
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderGrant: () => {
        dragStartOffsetRef.current = offsetRef.current;
      },
      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx } = gestureState;
        const rawOffset = dragStartOffsetRef.current + dx;
        const clampedOffset = clamp(rawOffset, 0, minimizedOffset);
        messagesOffsetAnim.setValue(clampedOffset);
      },
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx, vx } = gestureState;
        const rawOffset = dragStartOffsetRef.current + dx;
        const clampedOffset = clamp(rawOffset, 0, minimizedOffset);

        let shouldOpen: boolean;

        if (vx <= -0.4) {
          // fast swipe left → open
          shouldOpen = true;
        } else if (vx >= 0.4) {
          // fast swipe right → close
          shouldOpen = false;
        } else {
          // slow drag → snap by position
          shouldOpen = clampedOffset < minimizedOffset / 2;
        }

        animateMessagesPane(shouldOpen);
      },
      onPanResponderTerminate: () => {
        // gesture cancelled → still snap to nearest state
        snapMessagesPaneToNearest();
      },
    }),
  ).current;

  // Drag gesture for bottom sheet
  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx, dy } = gestureState;
        return Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx);
      },
      onPanResponderGrant: () => {
        sheetDragStartRef.current = sheetOffsetRef.current;
      },
      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dy } = gestureState;
        const rawOffset = sheetDragStartRef.current + dy;
        const clampedOffset = clamp(rawOffset, 0, sheetHeight);
        sheetOffsetAnim.setValue(clampedOffset);
      },
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dy, vy } = gestureState;
        const rawOffset = sheetDragStartRef.current + dy;
        const clampedOffset = clamp(rawOffset, 0, sheetHeight);

        let shouldOpen = isPartnerSheetOpen;

        if (vy <= -0.4) {
          shouldOpen = true; // fling up
        } else if (vy >= 0.4) {
          shouldOpen = false; // fling down
        } else {
          shouldOpen = clampedOffset < sheetHeight / 2;
        }

        animatePartnerSheet(shouldOpen);
      },
      onPanResponderTerminate: () => {
        animatePartnerSheet(isPartnerSheetOpen);
      },
    }),
  ).current;

  const onPartnerHeaderPress = () => {
    animatePartnerSheet(true);
  };

  return (
    <View
      style={[styles.root, { backgroundColor: palette.bg }]}
      {...panResponder.panHandlers}
    >
      <PartnersLeftRail
        selectedPartnerId={selectedPartnerId}
        onSelectPartner={setSelectedPartnerId}
        onAddPartnerPress={onAddPartnerPress}
        onLogout={onLogout}
      />

      <PartnersCenterPane
        selectedPartner={selectedPartner}
        selectedGroupId={selectedGroupId}
        rootGroups={rootGroups}
        groupsForPartner={groupsForPartner}
        communitiesForPartner={communitiesForPartner}
        expandedCommunities={expandedCommunities}
        onToggleCommunity={toggleCommunity}
        onGroupPress={onGroupPress}
        onPartnerHeaderPress={onPartnerHeaderPress}
      />

      <PartnersMessagesPane
        width={width}
        messagesOffsetAnim={messagesOffsetAnim}
        isMessagesExpanded={isMessagesExpanded}
        toggleMessagesPane={toggleMessagesPane}
        selectedGroupId={selectedGroupId}
        groupsForPartner={groupsForPartner}
        selectedPartner={selectedPartner}
      />

      <PartnerSheet
        isOpen={isPartnerSheetOpen}
        sheetHeight={sheetHeight}
        sheetOffsetAnim={sheetOffsetAnim}
        overlayOpacity={overlayOpacity}
        sheetPanHandlers={sheetPanResponder.panHandlers}
        selectedPartner={selectedPartner}
        animatePartnerSheet={animatePartnerSheet}
      />
    </View>
  );
}
