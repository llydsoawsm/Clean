import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, SectionHeader, SegmentedControl, useScreenBottomPadding } from '@/components/ui';
import { theme } from '@/theme';

const ranges: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
];

export default function ReportsScreen() {
  const session = useAuthSession();
  const bottomPadding = useScreenBottomPadding();
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const maxTrendVal = Math.max(1, ...trends.map((t) => t.collections));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Reports" />

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
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
        <SegmentedControl
          options={ranges}
          value={rangeKey}
          onChange={setRangeKey}
          style={styles.rangeControl}
        />

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {/* 2x2 Summary */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Collected</Text>
                <Text style={styles.metricValue}>{formatPHP(summary.collections)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Sales</Text>
                <Text style={styles.metricValue}>{formatPHP(summary.orderValue)}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Orders</Text>
                <Text style={styles.metricValue}>{summary.totalOrders}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricCaption}>Avg. Order</Text>
                <Text style={styles.metricValue}>{formatPHP(summary.averageOrderValue)}</Text>
              </View>
            </View>

            {/* Unpaid Highlight */}
            <Pressable
              onPress={() => router.push('/payments' as any)}
              style={({ pressed }) => [styles.unpaidCard, pressed && styles.pressed]}
            >
              <View>
                <Text style={styles.metricCaption}>Unpaid Balance</Text>
                <Text
                  style={[
                    styles.metricValue,
                    summary.outstandingBalance > 0 && { color: theme.colors.danger },
                  ]}
                >
                  {formatPHP(summary.outstandingBalance)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.inkMuted} />
            </Pressable>

            {/* Daily Collections */}
            {trends.length > 0 ? (
              <Card>
                <SectionHeader title="Daily Collections" />
                {trends.map((t) => {
                  const pct = Math.round((t.collections / maxTrendVal) * 100);
                  return (
                    <View key={t.date} style={styles.trendRow}>
                      <Text style={styles.trendDate}>{t.date.slice(5)}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.max(pct, t.collections > 0 ? 4 : 0)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendVal}>{formatPHP(t.collections)}</Text>
                    </View>
                  );
                })}
              </Card>
            ) : null}

            {/* Top Services */}
            <Card>
              <SectionHeader title="Top Services" />
              {topServices.length === 0 ? (
                <Text style={styles.emptyCardText}>No data yet</Text>
              ) : (
                topServices.map((s, idx) => (
                  <View key={idx} style={[styles.serviceRow, idx > 0 && styles.rowDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        {s.service_name}
                      </Text>
                      <Text style={styles.serviceMeta}>
                        {s.order_count} {s.order_count === 1 ? 'order' : 'orders'}
                      </Text>
                    </View>
                    <Text style={styles.serviceRev}>{formatPHP(s.order_value)}</Text>
                  </View>
                ))
              )}
            </Card>

            {/* Top Customers */}
            <Card>
              <SectionHeader title="Top Customers" />
              {topCustomers.length === 0 ? (
                <Text style={styles.emptyCardText}>No data yet</Text>
              ) : (
                topCustomers.map((c, idx) => (
                  <View key={c.customer_id} style={[styles.serviceRow, idx > 0 && styles.rowDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        {c.customer_name || 'Customer'}
                      </Text>
                      <Text style={styles.serviceMeta}>
                        {c.order_count} {c.order_count === 1 ? 'order' : 'orders'}
                      </Text>
                    </View>
                    <Text style={styles.serviceRev}>{formatPHP(c.order_value)}</Text>
                  </View>
                ))
              )}
            </Card>

            {/* Payment Methods */}
            <Card>
              <SectionHeader title="Payment Methods" />
              {methods.length === 0 ? (
                <Text style={styles.emptyCardText}>No data yet</Text>
              ) : (
                methods.map((item, idx) => {
                  const pct = summary.collections > 0 ? Math.round((item.total / summary.collections) * 100) : 0;
                  return (
                    <View key={idx} style={[styles.methodBlock, idx > 0 && styles.rowDivider]}>
                      <View style={styles.methodHeader}>
                        <Text style={styles.serviceName}>{displayMethod(item.method)}</Text>
                        <Text style={styles.serviceRev}>
                          {formatPHP(item.total)} · {pct}%
                        </Text>
                      </View>
                      <View style={styles.methodTrack}>
                        <View style={[styles.methodFill, { width: `${Math.max(pct, item.total > 0 ? 4 : 0)}%` }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  rangeControl: {
    marginBottom: theme.spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  unpaidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  metricCaption: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trendDate: {
    color: theme.colors.inkMuted,
    fontSize: 11,
    width: 40,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    flex: 1,
    height: 9,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: theme.colors.brand,
    borderRadius: 5,
  },
  trendVal: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: '700',
    width: 72,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 8,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  serviceName: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  serviceMeta: {
    color: theme.colors.inkMuted,
    fontSize: 11,
    marginTop: 2,
  },
  serviceRev: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  methodBlock: {
    paddingVertical: 10,
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  methodTrack: {
    height: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  methodFill: {
    height: '100%',
    backgroundColor: theme.colors.brand,
    borderRadius: 3,
  },
  emptyCardText: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    paddingVertical: 6,
  },
});
