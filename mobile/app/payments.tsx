import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { displayMethod, getPaymentSummary, listOrdersWithBalance, listPayments } from '@/db/repositories/payments';
import { runSync } from '@/sync/engine';
import type { OrderRow, PaymentRow, PaymentStatus } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { formatShortDate } from '@/utils/dates';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, SegmentedControl, useScreenBottomPadding } from '@/components/ui';
import { shortTicket, theme, type MciIconName } from '@/theme';

type PaymentListItem = PaymentRow & {
  order_number: string;
  customer_name: string | null;
  order_total: number;
  order_balance: number;
  order_payment_status: PaymentStatus;
};

function methodIcon(method: string): MciIconName {
  const key = method.toUpperCase();
  if (key === 'CASH') return 'cash';
  if (key === 'GCASH') return 'cellphone';
  return 'wallet-outline';
}

export default function PaymentsScreen() {
  const session = useAuthSession();
  const bottomPadding = useScreenBottomPadding();
  const [tab, setTab] = useState<'transactions' | 'balances'>('transactions');
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<OrderRow[]>([]);
  const [financials, setFinancials] = useState({ collectedToday: 0, outstandingBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const [pays, summary, unpaid] = await Promise.all([
        listPayments({ shop_id: session.shop.id, limit: 100 }),
        getPaymentSummary(session.shop.id),
        listOrdersWithBalance({ shop_id: session.shop.id, limit: 100 }),
      ]);
      setPayments(pays);
      setFinancials({
        collectedToday: summary.collectedToday,
        outstandingBalance: summary.outstandingBalance,
      });
      setPendingOrders(unpaid);
    } catch (e) {
      console.warn('[Payments] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

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
      <ScreenHeader title="Payments" />

      {/* Snapshot */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Today</Text>
          <Text style={styles.summaryValue}>{formatPHP(financials.collectedToday)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
          <Text style={styles.summaryLabel}>Unpaid</Text>
          <Text
            style={[
              styles.summaryValue,
              financials.outstandingBalance > 0 && styles.summaryBalance,
            ]}
          >
            {formatPHP(financials.outstandingBalance)}
          </Text>
        </View>
      </Card>

      {/* Segmented Switch */}
      <SegmentedControl
        options={[
          { key: 'transactions', label: `Paid · ${payments.length}` },
          { key: 'balances', label: `Unpaid · ${pendingOrders.length}` },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabRow}
      />

      {loading ? (
        <LoadingState />
      ) : tab === 'transactions' ? (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand}
              colors={[theme.colors.brand]}
            />
          }
          ListEmptyComponent={<EmptyState icon="wallet-outline" title="No payments yet" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/payment-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}
            >
              <View style={[styles.itemIcon, styles.itemIconPaid]}>
                <MaterialCommunityIcons
                  name={methodIcon(item.method)}
                  size={20}
                  color={theme.colors.claimed}
                />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {item.customer_name ?? 'Customer'}
                </Text>
                <Text style={styles.metaText} numberOfLines={1}>
                  {shortTicket(item.order_number)} · {displayMethod(item.method)}
                  {item.reference ? ` · ${item.reference}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amountText}>+{formatPHP(item.amount_centavos)}</Text>
                <Text style={styles.metaText}>{formatShortDate(item.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={pendingOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand}
              colors={[theme.colors.brand]}
            />
          }
          ListEmptyComponent={<EmptyState icon="check-circle-outline" title="All paid" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}
            >
              <View style={[styles.itemIcon, styles.itemIconUnpaid]}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.danger} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {item.customer_name_snapshot ?? 'Customer'}
                </Text>
                <Text style={styles.metaText}>
                  {shortTicket(item.order_number)} · Total {formatPHP(item.total_centavos)}
                </Text>
              </View>
              <View style={styles.unpaidRight}>
                <Text style={styles.balanceText}>{formatPHP(item.balance_centavos)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.inkMuted} />
              </View>
            </Pressable>
          )}
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
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    marginBottom: 0,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  summaryValue: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryBalance: {
    color: theme.colors.danger,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.divider,
    marginHorizontal: theme.spacing.md,
  },
  tabRow: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.layout.listCardPadding,
    marginBottom: theme.layout.listGap,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...theme.shadow.card,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconPaid: {
    backgroundColor: theme.colors.claimedBg,
  },
  itemIconUnpaid: {
    backgroundColor: theme.colors.dangerBg,
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  customerName: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  amountText: {
    color: theme.colors.claimed,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unpaidRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
