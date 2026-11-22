import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getOrderCounts, listOrders } from '@/db/repositories/orders';
import { getPaymentSummary } from '@/db/repositories/payments';
import type { OrderRow } from '@/db/types';
import { getSyncStatus, runSync } from '@/sync/engine';
import { formatPHP } from '@/utils/money';
import { formatTodayHeader } from '@/utils/dates';
import { LoadingState } from '@/components/Feedback';
import { TabHeader } from '@/components/ScreenHeader';
import { useBottomNavPadding } from '@/components/BottomTabBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, SectionHeader } from '@/components/ui';
import { ORDER_STATUS_META, shortTicket, theme } from '@/theme';

export default function HomeScreen() {
  const { state } = useAuth();
  const bottomNavPadding = useBottomNavPadding();
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({
    ALL: 0,
    RECEIVED: 0,
    PROCESSING: 0,
    READY: 0,
    COMPLETED: 0,
  });
  const [paymentSummary, setPaymentSummary] = useState({
    collectedToday: 0,
    outstandingBalance: 0,
  });
  const [activeOrders, setActiveOrders] = useState<OrderRow[]>([]);
  const [syncState, setSyncState] = useState<'online' | 'offline' | 'syncing' | 'pending' | 'synced' | 'failed'>('online');
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const session = state.status === 'authenticated' ? state.session : null;

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      router.replace('/login' as any);
    }
  }, [state.status]);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const [counts, summary, sync, recent] = await Promise.all([
        getOrderCounts(session.shop.id),
        getPaymentSummary(session.shop.id),
        getSyncStatus(session.shop.id),
        listOrders({ shop_id: session.shop.id, limit: 12 }),
      ]);
      setOrderCounts(counts);
      setPaymentSummary({
        collectedToday: summary.collectedToday,
        outstandingBalance: summary.outstandingBalance,
      });
      setActiveOrders(recent.filter((o) => o.status !== 'COMPLETED').slice(0, 5));
      setPendingCount(sync.pending);
      if (sync.status === 'syncing') setSyncState('syncing');
      else if (sync.status === 'offline') setSyncState('offline');
      else if (sync.pending > 0) setSyncState(sync.status === 'failed' ? 'failed' : 'pending');
      else if (sync.status === 'synced') setSyncState('synced');
      else setSyncState('online');
    } catch (e) {
      console.warn('[Home] load error:', e);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      await runSync(session.shop.id, session.token).catch(() => {});
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  if (state.status === 'loading' || !session) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const syncLabel =
    refreshing || syncState === 'syncing'
      ? 'Syncing'
      : syncState === 'offline'
        ? 'Offline'
        : pendingCount > 0
          ? `${pendingCount} pending`
          : 'Synced';

  const syncDotColor =
    refreshing || syncState === 'syncing'
      ? theme.colors.brand
      : syncState === 'offline'
        ? theme.colors.inkMuted
        : pendingCount > 0
          ? theme.colors.readyDot
          : theme.colors.claimed;

  const readyCount = orderCounts.READY ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TabHeader
        title={session.shop.name}
        subtitle={formatTodayHeader()}
        right={
          <Pressable
            onPress={handleRefresh}
            style={({ pressed }) => [styles.syncPill, pressed && styles.pressed]}
            accessibilityLabel="Sync status"
          >
            <View style={[styles.syncDot, { backgroundColor: syncDotColor }]} />
            <Text style={styles.syncText}>{syncLabel}</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand}
            colors={[theme.colors.brand]}
          />
        }
      >
        {/* Counter Sales Card */}
        <Pressable
          onPress={() => router.push('/payments' as any)}
          style={({ pressed }) => [styles.heroCard, pressed && styles.heroPressed]}
        >
          <View style={styles.heroCol}>
            <Text style={styles.heroLabel}>Today</Text>
            <Text style={styles.heroAmount}>{formatPHP(paymentSummary.collectedToday)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={[styles.heroCol, styles.heroRight]}>
            <Text style={styles.heroLabel}>Unpaid</Text>
            <Text
              style={[
                styles.heroSecondary,
                paymentSummary.outstandingBalance > 0 && styles.heroUnpaid,
              ]}
            >
              {formatPHP(paymentSummary.outstandingBalance)}
            </Text>
          </View>
        </Pressable>

        {/* Laundry Queue Strip */}
        <View style={styles.queueRow}>
          <Pressable
            onPress={() => router.replace({ pathname: '/orders' as any, params: { status: 'RECEIVED' } })}
            style={({ pressed }) => [styles.queueTile, pressed && styles.pressed]}
          >
            <View style={[styles.queueIcon, { backgroundColor: theme.colors.receivedBg }]}>
              <MaterialCommunityIcons name="basket-outline" size={20} color={theme.colors.received} />
            </View>
            <Text style={styles.queueCount}>{orderCounts.RECEIVED ?? 0}</Text>
            <Text style={styles.queueLabel}>Drop-off</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace({ pathname: '/orders' as any, params: { status: 'PROCESSING' } })}
            style={({ pressed }) => [styles.queueTile, pressed && styles.pressed]}
          >
            <View style={[styles.queueIcon, { backgroundColor: theme.colors.washingBg }]}>
              <MaterialCommunityIcons name="washing-machine" size={20} color={theme.colors.washing} />
            </View>
            <Text style={styles.queueCount}>{orderCounts.PROCESSING ?? 0}</Text>
            <Text style={styles.queueLabel}>Washing</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace({ pathname: '/orders' as any, params: { status: 'READY' } })}
            style={({ pressed }) => [
              styles.queueTile,
              readyCount > 0 && styles.queueTileReady,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.queueIcon, { backgroundColor: theme.colors.readyBg }]}>
              <MaterialCommunityIcons name="hanger" size={20} color={theme.colors.ready} />
            </View>
            <Text style={[styles.queueCount, readyCount > 0 && { color: theme.colors.ready }]}>
              {readyCount}
            </Text>
            <Text style={[styles.queueLabel, readyCount > 0 && { color: theme.colors.ready, fontWeight: '600' }]}>
              Ready
            </Text>
          </Pressable>
        </View>

        {/* Quick Links */}
        <View style={styles.quickRow}>
          <Pressable
            onPress={() => router.push('/services' as any)}
            style={({ pressed }) => [styles.quickPill, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="tag-outline" size={17} color={theme.colors.brand} />
            <Text style={styles.quickText}>Services</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/reports' as any)}
            style={({ pressed }) => [styles.quickPill, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="chart-bar" size={17} color={theme.colors.brand} />
            <Text style={styles.quickText}>Reports</Text>
          </Pressable>
        </View>

        {/* Active Laundry List */}
        <SectionHeader
          title="In the Shop"
          right={
            <Pressable onPress={() => router.replace('/orders' as any)} hitSlop={8}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          }
        />

        <Card noPadding>
          {activeOrders.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No active laundry</Text>
              <Pressable
                onPress={() => router.push('/receive' as any)}
                style={({ pressed }) => [styles.emptyBtn, pressed && styles.emptyBtnPressed]}
              >
                <MaterialCommunityIcons name="plus" size={16} color={theme.colors.white} />
                <Text style={styles.emptyBtnText}>Drop-off</Text>
              </Pressable>
            </View>
          ) : (
            activeOrders.map((o, idx) => {
              const meta = ORDER_STATUS_META[o.status];
              return (
                <Pressable
                  key={o.id}
                  onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: o.id } })}
                  style={({ pressed }) => [
                    styles.ticketRow,
                    idx > 0 && styles.ticketDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={[styles.ticketIcon, { backgroundColor: meta.bg }]}>
                    <MaterialCommunityIcons name={meta.icon} size={18} color={meta.color} />
                  </View>

                  <View style={styles.ticketMain}>
                    <Text style={styles.ticketCustomer} numberOfLines={1}>
                      {o.customer_name_snapshot ?? 'Customer'}
                    </Text>
                    <Text style={styles.ticketSub} numberOfLines={1}>
                      {o.service_name_snapshot} · {shortTicket(o.order_number)}
                    </Text>
                  </View>

                  <View style={styles.ticketRight}>
                    <StatusBadge type="order" value={o.status} />
                    <Text
                      style={[
                        styles.ticketAmount,
                        o.balance_centavos > 0 && styles.ticketUnpaid,
                      ]}
                    >
                      {o.balance_centavos > 0
                        ? `Unpaid ${formatPHP(o.balance_centavos)}`
                        : formatPHP(o.total_centavos)}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncText: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  heroCard: {
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  heroPressed: {
    backgroundColor: theme.colors.brandDark,
  },
  heroCol: {
    flex: 1,
  },
  heroRight: {
    alignItems: 'flex-end',
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.brandOverlay,
    marginHorizontal: theme.spacing.md,
  },
  heroLabel: {
    color: theme.colors.brandOnMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  heroAmount: {
    color: theme.colors.white,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  heroSecondary: {
    color: theme.colors.white,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroUnpaid: {
    color: theme.colors.readyBg,
  },
  queueRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  queueTile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  queueTileReady: {
    borderColor: theme.colors.readyBorder,
    backgroundColor: theme.colors.readySurface,
  },
  queueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  queueCount: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  queueLabel: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.xl,
  },
  quickPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    ...theme.shadow.card,
  },
  quickText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  seeAll: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyBtnPressed: {
    backgroundColor: theme.colors.brandDark,
  },
  emptyBtnText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: theme.spacing.md,
    gap: 12,
  },
  ticketDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceWarm,
  },
  ticketIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketMain: {
    flex: 1,
  },
  ticketCustomer: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  ticketSub: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  ticketRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ticketAmount: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ticketUnpaid: {
    color: theme.colors.danger,
  },
});
