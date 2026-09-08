import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { listOrders, getOrderCounts } from '@/db/repositories/orders';
import type { OrderRow, OrderStatus } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { readyAgingLabel, isLongWaiting } from '@/utils/dates';

type Filter = 'ALL' | OrderStatus;

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'READY', label: 'Ready' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function OrdersScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ ALL: 0, RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, c] = await Promise.all([
        listOrders({ shop_id: shopId, status: filter === 'ALL' ? undefined : (filter as OrderStatus), search: search.trim() || undefined, limit: 50 }),
        getOrderCounts(shopId),
      ]);
      setOrders(rows);
      setCounts(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [shopId, search, filter]);

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
        <Text style={styles.title}>Orders</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchBox}>
        <TextInput placeholder="Search order #, customer, contact" value={search} onChangeText={setSearch} style={styles.searchInput} />
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label} {counts[f.key] ? `(${counts[f.key]})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#3157d5" />
          <Text style={styles.hint}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No orders</Text>
          <Text style={styles.emptyHint}>No {filter !== 'ALL' ? filter.toLowerCase() : ''} orders found. Works offline.</Text>
          <Pressable onPress={() => router.push('/receive' as any)} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Receive Laundry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const aging = item.status === 'READY' ? readyAgingLabel(item.ready_at) : '';
            const longWait = item.status === 'READY' && isLongWaiting(item.ready_at);
            return (
              <Pressable onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: item.id } })} style={[styles.card, longWait && styles.cardLongWait]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNumber}>{item.order_number}</Text>
                  <View style={[styles.badge, item.status === 'RECEIVED' ? styles.badgeReceived : item.status === 'PROCESSING' ? styles.badgeProcessing : item.status === 'READY' ? styles.badgeReady : styles.badgeCompleted]}>
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.customer}>{item.customer_name_snapshot ?? 'Customer'}</Text>
                <Text style={styles.service}>{item.service_name_snapshot} • {item.pricing_type_snapshot}</Text>
                <View style={styles.row}>
                  <Text style={styles.price}>{formatPHP(item.total_centavos)}</Text>
                  <Text style={styles.balance}>Bal: {formatPHP(item.balance_centavos)} • {item.payment_status}</Text>
                </View>
                {item.status === 'READY' && aging ? (
                  <Text style={[styles.aging, longWait && styles.agingLong]}>{aging} {longWait ? '• Waiting for pickup' : ''}</Text>
                ) : null}
                <Text style={styles.meta}>{new Date(item.received_at).toLocaleString()}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable onPress={() => router.push('/receive' as any)} style={styles.fab}>
        <Text style={styles.fabText}>＋ Receive Laundry</Text>
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
  searchBox: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  retryButton: { backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  retryText: { color: '#1e293b', fontWeight: '600' },
  emptyTitle: { color: '#1e293b', fontSize: 16, fontWeight: '700' },
  emptyHint: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6 },
  primaryButton: { backgroundColor: '#3157d5', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8 },
  cardLongWait: { borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: '#172554', fontSize: 14, fontWeight: '800' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeReceived: { backgroundColor: '#dbeafe' },
  badgeProcessing: { backgroundColor: '#fef9c3' },
  badgeReady: { backgroundColor: '#ffedd5' },
  badgeCompleted: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  customer: { color: '#0f172a', fontSize: 13, fontWeight: '600', marginTop: 4 },
  service: { color: '#475569', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  price: { color: '#3157d5', fontWeight: '800', fontSize: 13 },
  balance: { color: '#64748b', fontSize: 12 },
  aging: { color: '#d97706', fontSize: 11, marginTop: 4, fontWeight: '600' },
  agingLong: { color: '#b45309' },
  meta: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  fab: { position: 'absolute', bottom: 20, right: 16, left: 16, backgroundColor: '#172554', borderRadius: 12, padding: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
