import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import {
  getDailyTrends,
  getDateRange,
  getPaymentMethodBreakdown,
  getReportSummary,
  getTopCustomers,
  getTopServices,
  type DateRangeKey,
  type ReportSummary,
} from '@/db/repositories/reports';
import { displayMethod } from '@/db/repositories/payments';
import { formatPHP } from '@/utils/money';
import { LoadingState } from '@/components/Feedback';

const ranges: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

export default function ReportsScreen() {
  const session = useAuthSession();
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('today');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary>({
    collections: 0,
    orderValue: 0,
    outstandingBalance: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    orderStatuses: { RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0 },
    paymentStatuses: { UNPAID: 0, PARTIAL: 0, PAID: 0 },
  });
  const [topServices, setTopServices] = useState<{ service_name: string; order_count: number; order_value: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ customer_id: string; customer_name: string; order_count: number; order_value: number }[]>([]);
  const [methods, setMethods] = useState<{ method: string; total: number; count: number }[]>([]);
  const [trends, setTrends] = useState<{ date: string; collections: number; orderCount: number; orderValue: number }[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const range = getDateRange(rangeKey);
      const [sum, srvs, custs, meths, tr] = await Promise.all([
        getReportSummary(session.shop.id, range),
        getTopServices(session.shop.id, range, 5),
        getTopCustomers(session.shop.id, range, 5),
        getPaymentMethodBreakdown(session.shop.id, range),
        getDailyTrends(session.shop.id, range),
      ]);
      setSummary(sum);
      setTopServices(srvs);
      setTopCustomers(custs);
      setMethods(meths);
      setTrends(tr.slice(-7));
    } catch (e) {
      console.warn('[Reports] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session, rangeKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const maxTrendVal = Math.max(1, ...trends.map((t) => t.collections));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Reports</Text>
          <View style={{ width: 50 }} />
        </View>

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

        {loading ? (
          <LoadingState message="Calculating reports..." />
        ) : (
          <>
            {/* Overview Numbers */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Collections</Text>
                <Text style={styles.metricValue}>{formatPHP(summary.collections)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Order Value</Text>
                <Text style={styles.metricValue}>{formatPHP(summary.orderValue)}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Orders ({rangeKey})</Text>
                <Text style={styles.metricValue}>{summary.totalOrders}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Avg. Order Value</Text>
                <Text style={styles.metricValue}>{formatPHP(summary.averageOrderValue)}</Text>
              </View>
            </View>

            <View style={styles.fullCard}>
              <Text style={styles.metricCaption}>Total Shop Outstanding Balance</Text>
              <Text style={[styles.metricValue, { color: '#1d4ed8' }]}>{formatPHP(summary.outstandingBalance)}</Text>
            </View>

            {/* Daily Collections Trend */}
            {trends.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Daily Collections Trend</Text>
                {trends.map((t) => {
                  const pct = Math.round((t.collections / maxTrendVal) * 100);
                  return (
                    <View key={t.date} style={styles.trendRow}>
                      <Text style={styles.trendDate}>{t.date.slice(5)}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.max(pct, t.collections > 0 ? 4 : 0)}%` }]} />
                      </View>
                      <Text style={styles.trendVal}>{formatPHP(t.collections)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Top Services */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Services</Text>
              {topServices.length === 0 ? (
                <Text style={styles.emptyCardText}>No orders recorded in this period.</Text>
              ) : (
                topServices.map((s, idx) => (
                  <View key={idx} style={styles.serviceRow}>
                    <View>
                      <Text style={styles.serviceName}>{s.service_name}</Text>
                      <Text style={styles.serviceMeta}>
                        {s.order_count} {s.order_count === 1 ? 'order' : 'orders'}
                      </Text>
                    </View>
                    <Text style={styles.serviceRev}>{formatPHP(s.order_value)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Top Customers */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Customers</Text>
              {topCustomers.length === 0 ? (
                <Text style={styles.emptyCardText}>No customer activity in this period.</Text>
              ) : (
                topCustomers.map((c) => (
                  <View key={c.customer_id} style={styles.serviceRow}>
                    <View>
                      <Text style={styles.serviceName}>{c.customer_name || 'Customer'}</Text>
                      <Text style={styles.serviceMeta}>
                        {c.order_count} {c.order_count === 1 ? 'order' : 'orders'}
                      </Text>
                    </View>
                    <Text style={styles.serviceRev}>{formatPHP(c.order_value)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Payment Methods */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Methods</Text>
              {methods.length === 0 ? (
                <Text style={styles.emptyCardText}>No payment transactions recorded in this period.</Text>
              ) : (
                methods.map((item, idx) => {
                  const pct = summary.collections > 0 ? Math.round((item.total / summary.collections) * 100) : 0;
                  return (
                    <View key={idx} style={styles.serviceRow}>
                      <View>
                        <Text style={styles.serviceName}>{displayMethod(item.method)}</Text>
                        <Text style={styles.serviceMeta}>
                          {item.count} {item.count === 1 ? 'payment' : 'payments'}
                        </Text>
                      </View>
                      <Text style={styles.serviceRev}>
                        {formatPHP(item.total)} ({pct}%)
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
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
  metricValue: { color: '#0f172a', fontSize: 17, fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { color: '#0f172a', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  trendDate: { color: '#64748b', fontSize: 11, width: 42 },
  barTrack: { flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#1d4ed8', borderRadius: 5 },
  trendVal: { color: '#0f172a', fontSize: 11, fontWeight: '600', width: 72, textAlign: 'right' },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  serviceName: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  serviceMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  serviceRev: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  emptyCardText: { color: '#94a3b8', fontSize: 13, paddingVertical: 8 },
});
