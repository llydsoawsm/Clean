import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { listPayments, getPaymentSummary, listOrdersWithBalance, displayMethod } from '@/db/repositories/payments';
import { listOrders } from '@/db/repositories/orders';
import type { PaymentStatus } from '@/db/types';
import { formatPHP } from '@/utils/money';

type PayFilter = 'ALL' | PaymentStatus;
type DateFilter = 'today' | '7days' | 'month' | 'all';
type ViewMode = 'transactions' | 'balances';

const payFilters: { key: PayFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNPAID', label: 'Unpaid' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'PAID', label: 'Paid' },
];

const dateFilters: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All' },
];

export default function PaymentsScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState<PayFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('transactions');
  const [summary, setSummary] = useState<{ collectedToday: number; collectedThisWeek: number; collectedThisMonth: number; outstandingBalance: number; unpaidOrders: number; partialOrders: number; paidOrders: number } | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await getPaymentSummary(shopId);
      setSummary(s);
      if (viewMode === 'transactions') {
        const rows = await listPayments({
          shop_id: shopId,
          status: payFilter === 'ALL' ? undefined : payFilter,
          search: search.trim() || undefined,
          dateFilter: dateFilter === 'all' ? undefined : dateFilter,
          limit: 50,
        });
        setPayments(rows);
      } else {
        // Balances view: filter orders with balance >0, optionally by payment_status
        if (payFilter === 'PAID') {
          // PAID should show no balances, but show PAID orders count; we show empty with hint
          setBalances([]);
        } else {
          const rows = payFilter === 'ALL'
            ? await listOrdersWithBalance({ shop_id: shopId, search: search.trim() || undefined, limit: 50 })
            : await listOrdersWithBalance({ shop_id: shopId, payment_status: payFilter as PaymentStatus, search: search.trim() || undefined, limit: 50 });
          setBalances(rows);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [shopId, search, payFilter, dateFilter, viewMode]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Payments</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Financial Summary</Text>
          {summary ? (
            <>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Collected Today</Text>
                  <Text style={styles.summaryValue}>{formatPHP(summary.collectedToday)}</Text>
                  <Text style={styles.summaryHint}>Payments today</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                  <Text style={[styles.summaryValue, { color: '#b45309' }]}>{formatPHP(summary.outstandingBalance)}</Text>
                  <Text style={styles.summaryHint}>Remaining balances</Text>
                </View>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryBoxSmall}>
                  <Text style={styles.summaryLabel}>Unpaid</Text>
                  <Text style={styles.summaryNumber}>{summary.unpaidOrders}</Text>
                  <Text style={styles.summaryHint}>orders</Text>
                </View>
                <View style={styles.summaryBoxSmall}>
                  <Text style={styles.summaryLabel}>Partial</Text>
                  <Text style={styles.summaryNumber}>{summary.partialOrders}</Text>
                  <Text style={styles.summaryHint}>orders</Text>
                </View>
                <View style={styles.summaryBoxSmall}>
                  <Text style={styles.summaryLabel}>Paid</Text>
                  <Text style={styles.summaryNumber}>{summary.paidOrders}</Text>
                  <Text style={styles.summaryHint}>orders</Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryHint}>Week: {formatPHP(summary.collectedThisWeek)} • Month: {formatPHP(summary.collectedThisMonth)}</Text>
              </View>
            </>
          ) : (
            <ActivityIndicator color="#3157d5" />
          )}
          <Text style={styles.summaryNote}>Shop-scoped, local SQLite, works offline</Text>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <TextInput placeholder="Search order #, customer, contact, reference" value={search} onChangeText={setSearch} style={styles.searchInput} />
        </View>

        {/* Payment Status Filters */}
        <View style={styles.filterRow}>
          {payFilters.map((f) => (
            <Pressable key={f.key} onPress={() => setPayFilter(f.key)} style={[styles.chip, payFilter === f.key && styles.chipActive]}>
              <Text style={[styles.chipText, payFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Date Filters (for transactions) */}
        {viewMode === 'transactions' && (
          <View style={styles.filterRow}>
            {dateFilters.map((f) => (
              <Pressable key={f.key} onPress={() => setDateFilter(f.key)} style={[styles.chip, dateFilter === f.key && styles.chipActive]}>
                <Text style={[styles.chipText, dateFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* View Mode Toggle */}
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setViewMode('transactions')} style={[styles.toggleButton, viewMode === 'transactions' && styles.toggleActive]}>
            <Text style={[styles.toggleText, viewMode === 'transactions' && styles.toggleTextActive]}>Transactions</Text>
          </Pressable>
          <Pressable onPress={() => setViewMode('balances')} style={[styles.toggleButton, viewMode === 'balances' && styles.toggleActive]}>
            <Text style={[styles.toggleText, viewMode === 'balances' && styles.toggleTextActive]}>Outstanding</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#3157d5" />
            <Text style={styles.hint}>Loading payments...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : viewMode === 'transactions' ? (
          payments.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No transactions</Text>
              <Text style={styles.emptyHint}>No {payFilter !== 'ALL' ? payFilter.toLowerCase() : ''} payments found. Works offline.</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              {payments.map((p) => (
                <Pressable key={p.id} onPress={() => router.push({ pathname: '/payment-detail' as any, params: { id: p.id } })} style={styles.txCard}>
                  <View style={styles.txHeader}>
                    <Text style={styles.txAmount}>{formatPHP(p.amount_centavos)}</Text>
                    <View style={styles.methodBadge}>
                      <Text style={styles.methodText}>{displayMethod(p.method)}</Text>
                    </View>
                  </View>
                  <Text style={styles.txOrder}>{p.order_number} • {p.customer_name ?? 'Customer'}</Text>
                  <Text style={styles.txMeta}>{new Date(p.created_at).toLocaleString()} • Bal: {formatPHP(p.order_balance)} • {p.order_payment_status}</Text>
                  {p.reference ? <Text style={styles.txRef}>Ref: {p.reference}</Text> : null}
                  {p.notes ? <Text style={styles.txNotes}>{p.notes}</Text> : null}
                </Pressable>
              ))}
            </View>
          )
        ) : balances.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No outstanding balances</Text>
            <Text style={styles.emptyHint}>{payFilter === 'PAID' ? 'Paid orders have 0 balance' : 'All caught up!'}</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {balances.map((o) => (
              <Pressable key={o.id} onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: o.id } })} style={styles.balanceCard}>
                <View style={styles.balanceHeader}>
                  <Text style={styles.balanceOrder}>{o.order_number}</Text>
                  <View style={[styles.badge, o.payment_status === 'UNPAID' ? styles.badgeUnpaid : o.payment_status === 'PARTIAL' ? styles.badgePartial : styles.badgePaid]}>
                    <Text style={styles.badgeText}>{o.payment_status}</Text>
                  </View>
                </View>
                <Text style={styles.balanceCustomer}>{o.customer_name_snapshot ?? 'Customer'}</Text>
                <View style={styles.balanceGrid}>
                  <View>
                    <Text style={styles.balanceLabel}>Total</Text>
                    <Text style={styles.balanceValue}>{formatPHP(o.total_centavos)}</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceLabel}>Paid</Text>
                    <Text style={styles.balanceValue}>{formatPHP(o.amount_paid_centavos)}</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceLabel}>Balance</Text>
                    <Text style={[styles.balanceValue, { color: '#b45309' }]}>{formatPHP(o.balance_centavos)}</Text>
                  </View>
                </View>
                <Text style={styles.txMeta}>Tap to add payment • {new Date(o.received_at).toLocaleDateString()}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable onPress={() => router.push('/orders' as any)} style={styles.fab}>
        <Text style={styles.fabText}>View Orders</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  title: { color: '#172554', fontSize: 18, fontWeight: '800' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, margin: 16, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  summaryTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  summaryBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  summaryBoxSmall: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  summaryValue: { color: '#172554', fontSize: 16, fontWeight: '800', marginTop: 4 },
  summaryNumber: { color: '#172554', fontSize: 18, fontWeight: '800', marginTop: 4 },
  summaryHint: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  summaryRow: { alignItems: 'center', marginTop: 4 },
  summaryNote: { color: '#94a3b8', fontSize: 10, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  searchBox: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4 },
  toggleButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  toggleActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 4 },
  toggleText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  toggleTextActive: { color: '#172554' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 20 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  retryButton: { backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  retryText: { color: '#1e293b', fontWeight: '600' },
  emptyTitle: { color: '#1e293b', fontSize: 16, fontWeight: '700' },
  emptyHint: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6 },
  txCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8 },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txAmount: { color: '#3157d5', fontSize: 16, fontWeight: '800' },
  methodBadge: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  methodText: { color: '#475569', fontSize: 11, fontWeight: '600' },
  txOrder: { color: '#0f172a', fontSize: 13, fontWeight: '600', marginTop: 4 },
  txMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  txRef: { color: '#475569', fontSize: 11, marginTop: 2, fontFamily: 'monospace' },
  txNotes: { color: '#334155', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  balanceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8, borderWidth: 1, borderColor: '#fef3c7' },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceOrder: { color: '#172554', fontSize: 14, fontWeight: '800' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeUnpaid: { backgroundColor: '#fee2e2' },
  badgePartial: { backgroundColor: '#fef9c3' },
  badgePaid: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  balanceCustomer: { color: '#475569', fontSize: 12, marginTop: 4 },
  balanceGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  balanceLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },
  balanceValue: { color: '#0f172a', fontSize: 13, fontWeight: '700', marginTop: 2 },
  fab: { position: 'absolute', bottom: 20, right: 16, left: 16, backgroundColor: '#172554', borderRadius: 12, padding: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
