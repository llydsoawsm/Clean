import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getOrderCounts } from '@/db/repositories/orders';
import { theme, type MciIconName } from '@/theme';

type TabKey = 'home' | 'orders' | 'customers' | 'shop';

const TAB_SLOT: Record<TabKey, number> = {
  home: 0,
  orders: 1,
  customers: 3,
  shop: 4,
};

const TAB_PATH: Record<TabKey, string> = {
  home: '/',
  orders: '/orders',
  customers: '/customers',
  shop: '/settings',
};

function resolveTab(pathname: string): TabKey | null {
  if (pathname === '/' || pathname === '/index') return 'home';
  if (pathname === '/orders') return 'orders';
  if (pathname === '/customers') return 'customers';
  if (pathname === '/settings') return 'shop';
  return null;
}

function slotFromLocalX(localX: number, width: number): TabKey {
  const ratio = localX / width;
  if (ratio < 0.22) return 'home';
  if (ratio < 0.5) return 'orders';
  if (ratio < 0.78) return 'customers';
  return 'shop';
}

export function useBottomNavPadding(): number {
  const insets = useSafeAreaInsets();
  return 96 + Math.max(insets.bottom, 10);
}

function AnimatedTabButton({
  label,
  icon,
  activeIcon,
  active,
  wiggleOnActive,
  badgeDot,
  onPress,
}: {
  label: string;
  icon: MciIconName;
  activeIcon: MciIconName;
  active: boolean;
  wiggleOnActive?: boolean;
  badgeDot?: boolean;
  onPress: () => void;
}) {
  const activeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;
  const wasActiveRef = useRef(active);

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      damping: 17,
      stiffness: 230,
      mass: 0.78,
    }).start();

    if (wiggleOnActive && active && !wasActiveRef.current) {
      wiggleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: -1, duration: 85, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: 0.7, duration: 95, useNativeDriver: true }),
        Animated.spring(wiggleAnim, { toValue: 0, useNativeDriver: true, damping: 10, stiffness: 260 }),
      ]).start();
    }
    wasActiveRef.current = active;
  }, [active, activeAnim, wiggleOnActive, wiggleAnim]);

  useEffect(() => {
    if (!badgeDot) {
      haloAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [badgeDot, haloAnim]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 44,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 26,
      bounciness: 10,
    }).start();
  };

  const iconTranslateY = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2.5],
  });

  const iconScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const wiggleDeg = wiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const haloScale = haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const haloOpacity = haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale: pressAnim }] }]}>
        <Animated.View
          style={[
            styles.iconWrap,
            {
              transform: [
                { translateY: iconTranslateY },
                { scale: iconScale },
                { rotate: wiggleDeg },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons
            name={active ? activeIcon : icon}
            size={22}
            color={active ? theme.colors.brand : theme.colors.inkMuted}
          />
          {badgeDot ? (
            <View style={styles.dotWrap} pointerEvents="none">
              <Animated.View
                style={[
                  styles.readyHalo,
                  { opacity: haloOpacity, transform: [{ scale: haloScale }] },
                ]}
              />
              <View style={styles.readyDot} />
            </View>
          ) : null}
        </Animated.View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function PersistentBottomTabBar() {
  const pathname = usePathname();
  const { state } = useAuth();
  const insets = useSafeAreaInsets();
  const dockBottom = Math.max(insets.bottom, 10);

  const activeTab = resolveTab(pathname);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [dragHoverTab, setDragHoverTab] = useState<TabKey | null>(null);

  const visible = state.status === 'authenticated' && activeTab !== null && !keyboardOpen;

  const barTranslateY = useRef(new Animated.Value(130)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const pillScaleX = useRef(new Animated.Value(1)).current;
  const pillScaleY = useRef(new Animated.Value(1)).current;
  const hasMeasuredRef = useRef(false);
  const prevSlotRef = useRef<number | null>(null);

  const plusScale = useRef(new Animated.Value(1)).current;
  const plusSpin = useRef(new Animated.Value(0)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  const rowRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const rowPageXRef = useRef(0);
  const barWidthRef = useRef(0);
  const pillWidthRef = useRef(0);
  const activeTabRef = useRef<TabKey | null>(activeTab);
  const isDraggingRef = useRef(false);
  const dragHoverRef = useRef<TabKey | null>(null);

  activeTabRef.current = activeTab;
  barWidthRef.current = barWidth;

  const slotWidth = barWidth > 0 ? barWidth / 5 : 0;
  const pillWidth = slotWidth > 0 ? Math.min(slotWidth - 8, 60) : 0;
  pillWidthRef.current = pillWidth;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(barTranslateY, {
        toValue: visible ? 0 : 130,
        useNativeDriver: true,
        damping: 20,
        stiffness: 210,
        mass: 0.85,
      }),
      Animated.timing(barOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 130,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, barTranslateY, barOpacity]);

  useEffect(() => {
    if (state.status !== 'authenticated' || activeTab === null) return;
    let cancelled = false;
    const shopId = state.session.shop.id;
    initDatabase()
      .then(() => getOrderCounts(shopId))
      .then((counts) => {
        if (!cancelled) setReadyCount(counts.READY ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state, activeTab, pathname]);

  useEffect(() => {
    if (slotWidth <= 0 || activeTab === null || isDraggingRef.current) return;
    const targetSlot = TAB_SLOT[activeTab];
    const targetX = targetSlot * slotWidth + (slotWidth - pillWidth) / 2;

    if (!hasMeasuredRef.current) {
      indicatorX.setValue(targetX);
      prevSlotRef.current = targetSlot;
      hasMeasuredRef.current = true;
      return;
    }

    const prevSlot = prevSlotRef.current ?? targetSlot;
    prevSlotRef.current = targetSlot;

    if (prevSlot === targetSlot) {
      Animated.spring(indicatorX, {
        toValue: targetX,
        useNativeDriver: true,
        damping: 18,
        stiffness: 210,
        mass: 0.8,
      }).start();
      return;
    }

    const distance = Math.abs(targetSlot - prevSlot);
    const stretchX = Math.min(1.18 + distance * 0.05, 1.34);

    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: targetX,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      }),
      Animated.sequence([
        Animated.timing(pillScaleX, {
          toValue: stretchX,
          duration: 95,
          useNativeDriver: true,
        }),
        Animated.spring(pillScaleX, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 220,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pillScaleY, {
          toValue: 0.9,
          duration: 95,
          useNativeDriver: true,
        }),
        Animated.spring(pillScaleY, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 220,
        }),
      ]),
    ]).start();
  }, [activeTab, slotWidth, pillWidth, indicatorX, pillScaleX, pillScaleY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gs) =>
          barWidthRef.current > 0 &&
          Math.abs(gs.dx) > 10 &&
          Math.abs(gs.dx) > Math.abs(gs.dy),
        onPanResponderGrant: () => {
          isDraggingRef.current = true;
          rowRef.current?.measureInWindow((x: number) => {
            if (typeof x === 'number') rowPageXRef.current = x;
          });
          Animated.parallel([
            Animated.spring(pillScaleX, {
              toValue: 1.14,
              useNativeDriver: true,
              speed: 30,
              bounciness: 6,
            }),
            Animated.spring(pillScaleY, {
              toValue: 0.94,
              useNativeDriver: true,
              speed: 30,
              bounciness: 6,
            }),
          ]).start();
        },
        onPanResponderMove: (evt, gs) => {
          const width = barWidthRef.current;
          const pw = pillWidthRef.current;
          if (width <= 0 || pw <= 0) return;
          const pageX = evt.nativeEvent.pageX ?? gs.moveX;
          const localX = Math.max(0, Math.min(width, pageX - rowPageXRef.current));
          const clampedX = Math.max(0, Math.min(width - pw, localX - pw / 2));
          indicatorX.setValue(clampedX);
          const hovered = slotFromLocalX(localX, width);
          if (dragHoverRef.current !== hovered) {
            dragHoverRef.current = hovered;
            setDragHoverTab(hovered);
          }
        },
        onPanResponderRelease: (evt, gs) => {
          const width = barWidthRef.current;
          const pw = pillWidthRef.current;
          const pageX = evt.nativeEvent.pageX ?? gs.moveX;
          const localX = width > 0 ? Math.max(0, Math.min(width, pageX - rowPageXRef.current)) : 0;
          const target =
            width > 0
              ? slotFromLocalX(localX, width)
              : dragHoverRef.current ?? activeTabRef.current ?? 'home';

          isDraggingRef.current = false;
          dragHoverRef.current = null;
          setDragHoverTab(null);

          const slotW = width > 0 ? width / 5 : 0;
          if (slotW > 0 && pw > 0) {
            const targetSlot = TAB_SLOT[target];
            prevSlotRef.current = targetSlot;
            const targetX = targetSlot * slotW + (slotW - pw) / 2;
            Animated.parallel([
              Animated.spring(indicatorX, {
                toValue: targetX,
                useNativeDriver: true,
                damping: 18,
                stiffness: 210,
                mass: 0.8,
              }),
              Animated.spring(pillScaleX, {
                toValue: 1,
                useNativeDriver: true,
                damping: 14,
                stiffness: 220,
              }),
              Animated.spring(pillScaleY, {
                toValue: 1,
                useNativeDriver: true,
                damping: 14,
                stiffness: 220,
              }),
            ]).start();
          }

          if (target !== activeTabRef.current) {
            router.replace(TAB_PATH[target] as any);
          }
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          dragHoverRef.current = null;
          setDragHoverTab(null);
          const width = barWidthRef.current;
          const pw = pillWidthRef.current;
          const current = activeTabRef.current;
          const slotW = width > 0 ? width / 5 : 0;
          if (current && slotW > 0 && pw > 0) {
            const targetX = TAB_SLOT[current] * slotW + (slotW - pw) / 2;
            Animated.parallel([
              Animated.spring(indicatorX, {
                toValue: targetX,
                useNativeDriver: true,
                damping: 18,
                stiffness: 210,
              }),
              Animated.spring(pillScaleX, { toValue: 1, useNativeDriver: true }),
              Animated.spring(pillScaleY, { toValue: 1, useNativeDriver: true }),
            ]).start();
          }
        },
      }),
    [indicatorX, pillScaleX, pillScaleY]
  );

  const handleRowLayout = (e: LayoutChangeEvent) => {
    const nextW = e.nativeEvent.layout.width;
    if (nextW > 0 && Math.abs(nextW - barWidth) > 0.5) {
      setBarWidth(nextW);
    }
    rowRef.current?.measureInWindow((x: number) => {
      if (typeof x === 'number') rowPageXRef.current = x;
    });
  };

  const navigateTab = (tab: TabKey) => {
    if (activeTab === tab) return;
    router.replace(TAB_PATH[tab] as any);
  };

  const handlePlusPressIn = () => {
    Animated.spring(plusScale, {
      toValue: 0.86,
      useNativeDriver: true,
      speed: 44,
      bounciness: 6,
    }).start();
  };

  const handlePlusPressOut = () => {
    Animated.spring(plusScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 10,
    }).start();
  };

  const handlePlusPress = () => {
    rippleScale.setValue(1);
    rippleOpacity.setValue(0.35);
    plusSpin.setValue(1);
    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 1.75,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.spring(plusSpin, {
        toValue: 0,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }),
    ]).start();
    router.push('/receive' as any);
  };

  const spinDeg = plusSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  const highlightedTab = dragHoverTab ?? activeTab;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.dock,
        {
          bottom: dockBottom,
          opacity: barOpacity,
          transform: [{ translateY: barTranslateY }],
        },
      ]}
    >
      <View
        ref={rowRef}
        style={styles.row}
        onLayout={handleRowLayout}
        {...panResponder.panHandlers}
      >
        {pillWidth > 0 && activeTab !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slidingPillWrap,
              {
                width: pillWidth,
                transform: [
                  { translateX: indicatorX },
                  { scaleX: pillScaleX },
                  { scaleY: pillScaleY },
                ],
              },
            ]}
          >
            <View style={styles.topCap} />
            <View style={styles.pillBody} />
          </Animated.View>
        ) : null}

        <AnimatedTabButton
          label="Today"
          icon="home-variant-outline"
          activeIcon="home-variant"
          active={highlightedTab === 'home'}
          onPress={() => navigateTab('home')}
        />

        <AnimatedTabButton
          label="Orders"
          icon="basket-outline"
          activeIcon="basket"
          active={highlightedTab === 'orders'}
          wiggleOnActive
          badgeDot={readyCount > 0}
          onPress={() => navigateTab('orders')}
        />

        <View style={styles.centerSlot}>
          <View style={styles.fabAnchor}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                {
                  opacity: rippleOpacity,
                  transform: [{ scale: rippleScale }],
                },
              ]}
            />
            <Pressable
              onPress={handlePlusPress}
              onPressIn={handlePlusPressIn}
              onPressOut={handlePlusPressOut}
              accessibilityLabel="New drop-off"
            >
              <Animated.View
                style={[
                  styles.centerBtn,
                  { transform: [{ scale: plusScale }, { rotate: spinDeg }] },
                ]}
              >
                <MaterialCommunityIcons name="plus" size={25} color={theme.colors.white} />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        <AnimatedTabButton
          label="Customers"
          icon="account-group-outline"
          activeIcon="account-group"
          active={highlightedTab === 'customers'}
          onPress={() => navigateTab('customers')}
        />

        <AnimatedTabButton
          label="Shop"
          icon="storefront-outline"
          activeIcon="storefront"
          active={highlightedTab === 'shop'}
          onPress={() => navigateTab('shop')}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 50,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
  },
  slidingPillWrap: {
    position: 'absolute',
    top: 0,
    bottom: 2,
    left: 0,
    zIndex: 0,
    alignItems: 'center',
  },
  topCap: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.brand,
    marginBottom: 4,
  },
  pillBody: {
    width: '100%',
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSoft,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
  },
  iconWrap: {
    position: 'relative',
  },
  dotWrap: {
    position: 'absolute',
    top: -2,
    right: -5,
    width: 9,
    height: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyHalo: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.readyDot,
  },
  readyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.readyDot,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.inkMuted,
  },
  labelActive: {
    color: theme.colors.brand,
    fontWeight: '700',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  fabAnchor: {
    position: 'relative',
    marginTop: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.brand,
  },
  centerBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.brand,
    borderWidth: 4,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.brand,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
