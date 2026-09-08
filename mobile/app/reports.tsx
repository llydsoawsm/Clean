import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getDateRange, getReportSummary, getTopServices, getTopCustomers, getPaymentMethodBreakdown, getDailyTrends, DateRangeKey } from '@/db/repositories/reports';
import { formatPHP } from '@/utils/money';
import { displayMethod } from '@/db/repositories/payments';

type RangeKey = DateRangeKey;

const ranges: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

export default function ReportsScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getReportSummary>> | null>(null);
  const [topServices, setTopServices] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const range = getDateRange(rangeKey, customFrom || null, customTo || null);
      const [s, services, customers, m, t] = await Promise.all([
        getReportSummary(shopId, range),
        getTopServices(shopId, range, 5),
        getTopCustomers(shopId, range, 5),
        getPaymentMethodBreakdown(shopId, range),
        getDailyTrends(shopId, range),
      ]);
      setSummary(s);
      setTopServices(services);
      setTopCustomers(customers);
      setMethods(m);
      setTrends(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [shopId, rangeKey, customFrom, customTo]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const summaryCards = summary
    ? [
        { label: 'Collections', value: formatPHP(summary.collections), hint: 'Payments in range' },
        { label: 'Order Value', value: formatPHP(summary.orderValue), hint: 'Orders received' },
        { label: 'Outstanding', value: formatPHP(summary.outstandingBalance), hint: 'All shop balances' },
        { label: 'Orders', value: `${summary.totalOrders}`, hint: 'Received in range' },
        { label: 'Avg Order', value: formatPHP(summary.averageOrderValue), hint: 'Order Value / Orders' },
      ]
    : [];

  const maxCollections = Math.max(1, ...trends.map((d) => d.collections));
  const maxOrders = Math.max(1, ...trends.map((d) => d.orderCount));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Date Range */}
        <View style={styles.rangeCard}>
          <Text style={styles.cardTitle}>Date Range</Text>
          <View style={styles.chipRow}>
            {ranges.map((r) => (
              <Pressable key={r.key} onPress={() => setRangeKey(r.key)} style={[styles.chip, rangeKey === r.key && styles.chipActive]}>
                <Text style={[styles.chipText, rangeKey === r.key && styles.chipTextActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          {rangeKey === 'custom' && (
            <View style={styles.customRow}>
              <TextInput placeholder="From YYYY-MM-DD" value={customFrom} onChangeText={setCustomFrom} style={styles.customInput} />
              <TextInput placeholder="To YYYY-MM-DD" value={customTo} onChangeText={setCustomTo} style={styles.customInput} />
            </View>
          )}
          <Text style={styles.hint}>Grouping via DATE(*, 'localtime') — shop local, consistent for payments.received_at and payments.created_at. Outstanding is overall, not just range.</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#3157d5" />
            <Text style={styles.hint}>Loading reports...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !summary ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No data</Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              {summaryCards.map((c) => (
                <View key={c.label} style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{c.label}</Text>
                  <Text style={styles.summaryValue}>{c.value}</Text>
                  <Text style={styles.summaryHint}>{c.hint}</Text>
                </View>
              ))}
            </View>

            {/* Order Collections vs Value explainer */}
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>Order Value = total of orders received in range. Collections = sum of payment transactions in range. They differ when payments are partial or cross periods.</Text>
            </View>

            {/* Status Distributions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Order Status (in range)</Text>
              {(['RECEIVED', 'PROCESSING', 'READY', 'COMPLETED'] as const).map((s) => {
                const cnt = summary.orderStatuses[s] ?? 0;
                const max = Math.max(1, ...Object.values(summary.orderStatuses));
                return (
                  <View key={s} style={styles.barRow}>
                    <Text style={styles.barLabel}>{s}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(cnt / max) * 100}%`, backgroundColor: s === 'RECEIVED' ? '#dbeafe' : s === 'PROCESSING' ? '#fef9c3' : s === 'READY' ? '#ffedd5' : '#dcfce7' }]} />
                    </View>
                    <Text style={styles.barCount}>{cnt}</Text>
                  </View>
                );
              })}
              <Text style={styles.hint}>Current status of orders received within selected range.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Status (in range)</Text>
              {(['UNPAID', 'PARTIAL', 'PAID'] as const).map((s) => {
                const cnt = summary.paymentStatuses[s] ?? 0;
                const max = Math.max(1, ...Object.values(summary.paymentStatuses));
                return (
                  <View key={s} style={styles.barRow}>
                    <Text style={styles.barLabel}>{s}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(cnt / max) * 100}%`, backgroundColor: s === 'UNPAID' ? '#fee2e2' : s === 'PARTIAL' ? '#fef3c7' : '#dcfce7' }]} />
                    </View>
                    <Text style={styles.barCount}>{cnt}</Text>
                  </View>
                );
              })}
            </View>

            {/* Daily Trends */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Trend (local date)</Text>
              {trends.length === 0 ? (
                <Text style={styles.hint}>No activity for this period.</Text>
              ) : (
                trends.slice(-14).map((d) => (
                  <View key={d.date} style={styles.trendRow}>
                    <Text style={styles.trendDate}>{d.date.slice(5)}</Text>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <Text style={styles.trendLabel}>Collections</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(d.collections / maxCollections) * 100}%`, backgroundColor: '#3157d5' }]} />
                      </View>
                      <Text style={styles.trendLabel}>Orders {d.orderCount}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(d.orderCount / maxOrders) * 100}%`, backgroundColor: '#0ea5e9' }]} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.trendValue}>{formatPHP(d.collections)}</Text>
                      <Text style={styles.trendHint}>{d.orderCount} orders</Text>
                    </View>
                  </View>
                ))
              )}
              <Text style={styles.hint}>Collections = payments per day (local), Orders = received per day. Zero days shown as empty bars.</Text>
            </View>

            {/* Top Services */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Services (by orders, snapshot)</Text>
              {topServices.length === 0 ? (
                <Text style={styles.hint}>No activity for this period.</Text>
              ) : (
                topServices.map((s, i) => (
                  <View key={s.service_name} style={styles.topRow}>
                    <Text style={styles.topRank}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topName}>{s.service_name}</Text>
                      <Text style={styles.topHint}>{s.order_count} orders • {formatPHP(s.order_value)} order value</Text>
                    </View>
                  </View>
                ))
              )}
              <Text style={styles.hint}>Grouped by service_name_snapshot — historical reports preserve old names/prices.</Text>
            </View>

            {/* Top Customers */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Customers (by orders)</Text>
              {topCustomers.length === 0 ? (
                <Text style={styles.hint}>No activity for this period.</Text>
              ) : (
                topCustomers.map((c, i) => (
                  <View key={c.customer_id} style={styles.topRow}>
                    <Text style={styles.topRank}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topName}>{c.customer_name}</Text>
                      <Text style={styles.topHint}>{c.order_count} orders • {formatPHP(c.order_value)} value</Text>
                    </View>
                  </View>
                ))
              )}
              <Text style={styles.hint}>Shop-scoped, aggregated by customer_id snapshot.</Text>
            </View>

            {/* Payment Method Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Methods (in range)</Text>
              {methods.length === 0 ? (
                <Text style={styles.hint}>No payments in this period. Outstanding still shown separately.</Text>
              ) : (
                methods.map((m) => (
                  <View key={m.method} style={styles.methodRow}>
                    <Text style={styles.methodLabel}>{displayMethod(m.method)}</Text>
                    <Text style={styles.methodValue}>{formatPHP(m.total)} ({m.count})</Text>
                  </View>
                ))
              )}
              <Text style={styles.hint}>Totals from payment transactions, legacy/unknown shown as Unknown.</Text>
            </View>

            {summary.totalOrders === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No activity for this period.</Text>
                <Text style={styles.emptyHint}>Try All Time or a different range. Metrics show ₱0 and 0 orders safely.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  title: { color: '#172554', fontSize: 18, fontWeight: '800' },
  rangeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, margin: 16, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  cardTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  customInput: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, backgroundColor: '#f8fafc' },
  hint: { color: '#64748b', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 20 },
  error: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  retryButton: { backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  retryText: { color: '#1e293b', fontWeight: '600' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  summaryCard: { width: '48%', backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  summaryValue: { color: '#172554', fontSize: 16, fontWeight: '800', marginTop: 4 },
  summaryHint: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  noteBox: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  noteText: { color: '#166534', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 12, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  barLabel: { color: '#475569', fontSize: 11, fontWeight: '600', width: 90 },
  barTrack: { flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: 10, borderRadius: 6 },
  barCount: { color: '#0f172a', fontSize: 12, fontWeight: '700', width: 30, textAlign: 'right' },
  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  trendDate: { color: '#475569', fontSize: 11, width: 40, fontWeight: '600' },
  trendLabel: { color: '#94a3b8', fontSize: 10 },
  trendValue: { color: '#172554', fontSize: 12, fontWeight: '700' },
  trendHint: { color: '#64748b', fontSize: 10, marginTop: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  topRank: { color: '#3157d5', fontSize: 12, fontWeight: '800', width: 28 },
  topName: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  topHint: { color: '#64748b', fontSize: 11, marginTop: 2 },
  methodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  methodLabel: { color: '#475569', fontSize: 13, fontWeight: '600' },
  methodValue: { color: '#172554', fontSize: 13, fontWeight: '700' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginHorizontal: 16, marginTop: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700' },
  emptyHint: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 6 },
});
