import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { displayMethod, getPaymentSummary, listOrdersWithBalance, listPayments } from '@/db/repositories/payments';
import type { OrderRow, PaymentRow, PaymentStatus } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { formatDate } from '@/utils/dates';
import { LoadingState } from '@/components/Feedback';

type PaymentListItem = PaymentRow & {
  order_number: string;
  customer_name: string | null;
  order_total: number;
  order_balance: number;
  order_payment_status: PaymentStatus;
};

export default function PaymentsScreen() {
  const session = useAuthSession();
  const [tab, setTab] = useState<'transactions' | 'balances'>('transactions');
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<OrderRow[]>([]);
  const [financials, setFinancials] = useState({ collectedToday: 0, outstandingBalance: 0 });
  const [loading, setLoading] = useState(true);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Payments</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Financial Snapshot */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Collected Today</Text>
          <Text style={styles.summaryValue}>{formatPHP(financials.collectedToday)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Unpaid Balances</Text>
          <Text style={[styles.summaryValue, styles.summaryBalance]}>
            {formatPHP(financials.outstandingBalance)}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab('transactions')}
          style={[styles.tabBtn, tab === 'transactions' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>
            Transactions ({payments.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('balances')}
          style={[styles.tabBtn, tab === 'balances' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === 'balances' && styles.tabTextActive]}>
            Pending Balances ({pendingOrders.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <LoadingState message="Loading payments..." />
      ) : tab === 'transactions' ? (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No payment transactions recorded yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/payment-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.itemCard, pressed && styles.cardPressed]}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.customerName}>{item.customer_name ?? 'Customer'}</Text>
                <Text style={styles.metaText}>
                  {item.order_number} • {displayMethod(item.method)}
                  {item.reference ? ` • ${item.reference}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amountText}>+{formatPHP(item.amount_centavos)}</Text>
                <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={pendingOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>All customer orders are paid in full.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.itemCard, pressed && styles.cardPressed]}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.customerName}>{item.customer_name_snapshot ?? 'Customer'}</Text>
                <Text style={styles.metaText}>
                  {item.order_number} • Total {formatPHP(item.total_centavos)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.balanceText}>{formatPHP(item.balance_centavos)}</Text>
                <Text style={styles.metaText}>Tap to pay</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '700' },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryItem: { flex: 1 },
  summaryLabel: { color: '#64748b', fontSize: 11, fontWeight: '500', marginBottom: 2 },
  summaryValue: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  summaryBalance: { color: '#1d4ed8' },
  divider: { width: 1, backgroundColor: '#f1f5f9', marginHorizontal: 12 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabBtnActive: { backgroundColor: '#eff6ff' },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#1d4ed8', fontWeight: '600' },
  listContent: { padding: 18, paddingBottom: 40 },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPressed: { opacity: 0.7 },
  customerName: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  metaText: { color: '#64748b', fontSize: 11, marginTop: 2 },
  amountText: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
  balanceText: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 13 },
});
