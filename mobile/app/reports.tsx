import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPHP } from '@/utils/money';
import { orderStore, LocalOrder, LocalPayment } from '@/store/orderStore';

const ranges = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

export default function ReportsScreen() {
  const [rangeKey, setRangeKey] = useState('today');
  const [orders, setOrders] = useState<LocalOrder[]>(orderStore.getAll());
  const [payments, setPayments] = useState<LocalPayment[]>(orderStore.getAllPayments());

  useEffect(() => {
    const sync = () => {
      setOrders(orderStore.getAll());
      setPayments(orderStore.getAllPayments());
    };
    sync();
    const unsub = orderStore.subscribe(sync);
    return unsub;
  }, []);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOf7Days = now.getTime() - 7 * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const isIncluded = (dateStr: string) => {
    const time = new Date(dateStr).getTime();
    if (rangeKey === 'today') return time >= startOfToday;
    if (rangeKey === '7days') return time >= startOf7Days;
    if (rangeKey === 'month') return time >= startOfMonth;
    return true;
  };

  const filteredOrders = useMemo(() => orders.filter((o) => isIncluded(o.created_at)), [orders, rangeKey]);
  const filteredPayments = useMemo(() => payments.filter((p) => isIncluded(p.created_at)), [payments, rangeKey]);

  const totalCollections = useMemo(
    () => filteredPayments.reduce((acc, p) => acc + p.amount_centavos, 0),
    [filteredPayments]
  );

  const totalOrdersCount = filteredOrders.length;

  const totalOutstanding = useMemo(
    () => filteredOrders.reduce((acc, o) => acc + o.balance_centavos, 0),
    [filteredOrders]
  );

  const topServices = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filteredOrders.forEach((o) => {
      const sName = o.service_name || 'Laundry';
      const curr = map.get(sName) || { count: 0, revenue: 0 };
      map.set(sName, { count: curr.count + 1, revenue: curr.revenue + o.total_centavos });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, orders: data.count, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  const paymentBreakdown = useMemo(() => {
    const total = totalCollections || 1;
    let cash = 0;
    let gcash = 0;
    let other = 0;

    filteredPayments.forEach((p) => {
      if (p.method === 'CASH') cash += p.amount_centavos;
      else if (p.method === 'GCASH') gcash += p.amount_centavos;
      else other += p.amount_centavos;
    });

    return [
      { name: 'Cash', amount: cash, pct: totalCollections > 0 ? Math.round((cash / total) * 100) : 0 },
      { name: 'GCash', amount: gcash, pct: totalCollections > 0 ? Math.round((gcash / total) * 100) : 0 },
      { name: 'Other', amount: other, pct: totalCollections > 0 ? Math.round((other / total) * 100) : 0 },
    ];
  }, [filteredPayments, totalCollections]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Reports</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Range Selector */}
        <View style={styles.rangeRow}>
          {ranges.map((r) => {
            const active = rangeKey === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRangeKey(r.key)}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Overview Numbers */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricCaption}>Collections</Text>
            <Text style={styles.metricValue}>{formatPHP(totalCollections)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricCaption}>Orders</Text>
            <Text style={styles.metricValue}>{totalOrdersCount}</Text>
          </View>
        </View>

        <View style={styles.fullCard}>
          <Text style={styles.metricCaption}>Outstanding Balance</Text>
          <Text style={[styles.metricValue, { color: '#1d4ed8' }]}>{formatPHP(totalOutstanding)}</Text>
        </View>

        {/* Top Services */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Services</Text>
          {topServices.length === 0 ? (
            <Text style={styles.emptyCardText}>No orders recorded in this period.</Text>
          ) : (
            topServices.map((s, idx) => (
              <View key={idx} style={styles.serviceRow}>
                <View>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.serviceMeta}>{s.orders} {s.orders === 1 ? 'order' : 'orders'}</Text>
                </View>
                <Text style={styles.serviceRev}>{formatPHP(s.revenue)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Breakdown</Text>
          {filteredPayments.length === 0 ? (
            <Text style={styles.emptyCardText}>No payment transactions recorded in this period.</Text>
          ) : (
            paymentBreakdown.map((item, idx) => (
              <View key={idx} style={styles.serviceRow}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text style={styles.serviceRev}>
                  {formatPHP(item.amount)} ({item.pct}%)
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  rangeChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rangeChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  rangeText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  rangeTextActive: { color: '#ffffff', fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fullCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricCaption: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { color: '#0f172a', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  serviceName: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  serviceMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  serviceRev: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  emptyCardText: { color: '#94a3b8', fontSize: 13, paddingVertical: 8 },
});
