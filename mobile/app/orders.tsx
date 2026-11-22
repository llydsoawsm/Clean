import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getOrderCounts, listOrders } from '@/db/repositories/orders';
import { runSync } from '@/sync/engine';
import type { OrderRow, OrderStatus } from '@/db/types';
import { formatPHP, formatWeight } from '@/utils/money';
import { isLongWaiting, readyAgingLabel } from '@/utils/dates';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { TabHeader } from '@/components/ScreenHeader';
import { useBottomNavPadding } from '@/components/BottomTabBar';
import { RushBadge, StatusBadge } from '@/components/StatusBadge';
import { FilterChip, HeaderIconButton, SearchBar } from '@/components/ui';
import { ORDER_STATUS_META, shortTicket, theme } from '@/theme';

type Filter = 'ALL' | OrderStatus;

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RECEIVED', label: 'Drop-off' },
  { key: 'PROCESSING', label: 'Washing' },
  { key: 'READY', label: 'Ready' },
  { key: 'COMPLETED', label: 'Claimed' },
];

function parseFilterParam(param?: string): Filter {
  if (param && ['RECEIVED', 'PROCESSING', 'READY', 'COMPLETED'].includes(param.toUpperCase())) {
    return param.toUpperCase() as OrderStatus;
  }
  return 'ALL';
}

function orderUnitSummary(item: OrderRow): string {
  if (item.pricing_type_snapshot === 'per_piece') return `${item.quantity ?? 0} pc`;
  if (item.pricing_type_snapshot === 'fixed') return 'Fixed';
  return formatWeight(item.weight_grams);
}

export default function OrdersScreen() {
  const session = useAuthSession();
  const bottomNavPadding = useBottomNavPadding();
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(() => parseFilterParam(initialStatus));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    ALL: 0,
    RECEIVED: 0,
    PROCESSING: 0,
    READY: 0,
    COMPLETED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setFilter(parseFilterParam(initialStatus));
  }, [initialStatus]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const [rows, cnts] = await Promise.all([
        listOrders({
          shop_id: session.shop.id,
          status: filter === 'ALL' ? undefined : filter,
          search: search.trim() || undefined,
          limit: 100,
        }),
        getOrderCounts(session.shop.id),
      ]);
      setOrders(rows);
      setCounts(cnts);
    } catch (e) {
      console.warn('[Orders] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session, filter, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      await runSync(session.shop.id, session.token).catch(() => {});
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TabHeader
        title="Orders"
        count={counts.ALL ?? 0}
        right={
          <HeaderIconButton
            icon="plus"
            onPress={() => router.push('/receive' as any)}
            accessibilityLabel="New drop-off"
          />
        }
      />

      <View style={styles.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, or #"
          surface="card"
        />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => {
            const count = counts[f.key] ?? 0;
            const label = count > 0 && f.key !== 'ALL' ? `${f.label} · ${count}` : f.label;
            return (
              <FilterChip
                key={f.key}
                label={label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomNavPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand}
              colors={[theme.colors.brand]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="basket-outline"
              title="No orders"
              hint={search.trim() || filter !== 'ALL' ? 'Try another filter' : 'Tap + for a new drop-off'}
              actionLabel={!search.trim() && filter === 'ALL' ? 'New Drop-off' : undefined}
              onAction={!search.trim() && filter === 'ALL' ? () => router.push('/receive' as any) : undefined}
            />
          }
          renderItem={({ item }) => {
            const meta = ORDER_STATUS_META[item.status];
            const longWaiting = item.status === 'READY' && isLongWaiting(item.ready_at);
            const agingText = item.status === 'READY' ? readyAgingLabel(item.ready_at) : '';
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: item.id } })}
                style={({ pressed }) => [
                  styles.card,
                  longWaiting && styles.cardWaiting,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.customer} numberOfLines={1}>
                      {item.customer_name_snapshot ?? 'Customer'}
                    </Text>
                    <View style={styles.badges}>
                      {item.is_rush === 1 ? <RushBadge /> : null}
                      <StatusBadge type="order" value={item.status} />
                    </View>
                  </View>

                  <Text style={styles.subLine} numberOfLines={1}>
                    {item.service_name_snapshot} · {orderUnitSummary(item)} · {shortTicket(item.order_number)}
                  </Text>

                  <View style={styles.cardFooter}>
                    <Text style={styles.price}>{formatPHP(item.total_centavos)}</Text>
                    <View style={styles.footerRight}>
                      {agingText ? (
                        <View style={[styles.agingPill, longWaiting && styles.agingPillUrgent]}>
                          <Text style={[styles.agingText, longWaiting && styles.agingTextUrgent]}>
                            {agingText}
                          </Text>
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.balance,
                          item.balance_centavos > 0 ? styles.balanceUnpaid : styles.balancePaid,
                        ]}
                      >
                        {item.balance_centavos > 0 ? `Unpaid ${formatPHP(item.balance_centavos)}` : 'Paid'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  searchWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  filterContainer: {
    marginBottom: theme.spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    marginBottom: theme.layout.listGap,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardWaiting: {
    borderColor: theme.colors.readyBorder,
    backgroundColor: theme.colors.readySurface,
  },
  accentBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: theme.layout.listCardPadding,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  customer: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subLine: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  price: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agingPill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  agingPillUrgent: {
    backgroundColor: theme.colors.readyBg,
  },
  agingText: {
    color: theme.colors.inkSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  agingTextUrgent: {
    color: theme.colors.ready,
  },
  balance: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  balanceUnpaid: {
    color: theme.colors.danger,
  },
  balancePaid: {
    color: theme.colors.claimed,
  },
});
