import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getOrderCounts, listOrders } from '@/db/repositories/orders';
import type { OrderRow, OrderStatus } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { isLongWaiting, readyAgingLabel } from '@/utils/dates';
import { LoadingState } from '@/components/Feedback';

type Filter = 'ALL' | OrderStatus;

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'PROCESSING', label: 'Washing' },
  { key: 'READY', label: 'Ready' },
  { key: 'COMPLETED', label: 'Done' },
];

export default function OrdersScreen() {
  const session = useAuthSession();
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const normalizedInitial: Filter =
    initialStatus && ['RECEIVED', 'PROCESSING', 'READY', 'COMPLETED'].includes(initialStatus.toUpperCase())
      ? (initialStatus.toUpperCase() as OrderStatus)
      : 'ALL';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(normalizedInitial);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    ALL: 0,
    RECEIVED: 0,
    PROCESSING: 0,
    READY: 0,
    COMPLETED: 0,
  });
  const [loading, setLoading] = useState(true);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Orders ({counts.ALL ?? 0})</Text>
        <Pressable onPress={() => router.push('/receive' as any)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#1d4ed8" />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search order #, customer, or phone"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => {
            const active = filter === f.key;
            const count = counts[f.key] ?? 0;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState message="Loading orders..." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim() || filter !== 'ALL'
                  ? 'No orders match the current filter.'
                  : 'There are currently no laundry orders recorded. Tap + to receive a new order.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const longWaiting = item.status === 'READY' && isLongWaiting(item.ready_at);
            const agingText = item.status === 'READY' ? readyAgingLabel(item.ready_at) : '';
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: item.id } })}
                style={({ pressed }) => [styles.card, longWaiting && styles.cardWaiting, pressed && styles.cardPressed]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNumber}>{item.order_number}</Text>
                  <View
                    style={[
                      styles.badge,
                      item.status === 'READY'
                        ? styles.badgeReady
                        : item.status === 'PROCESSING'
                          ? styles.badgeProcessing
                          : item.status === 'RECEIVED'
                            ? styles.badgeReceived
                            : styles.badgeCompleted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.status === 'READY' && styles.badgeTextReady,
                        item.status === 'PROCESSING' && styles.badgeTextProcessing,
                        item.status === 'RECEIVED' && styles.badgeTextReceived,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.customer}>{item.customer_name_snapshot ?? 'Customer'}</Text>
                <Text style={styles.service}>{item.service_name_snapshot}</Text>
                {agingText ? (
                  <Text style={[styles.agingText, longWaiting && styles.agingTextUrgent]}>{agingText}</Text>
                ) : null}

                <View style={styles.footerRow}>
                  <Text style={styles.price}>{formatPHP(item.total_centavos)}</Text>
                  <Text style={styles.balance}>
                    {item.balance_centavos > 0 ? `Bal: ${formatPHP(item.balance_centavos)}` : 'Paid'}
                  </Text>
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
  addBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  searchBox: { backgroundColor: '#ffffff', paddingHorizontal: 18, paddingBottom: 10 },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  listContent: { padding: 18, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardWaiting: { borderColor: '#fb923c', backgroundColor: '#fff7ed' },
  cardPressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#f1f5f9' },
  badgeReceived: { backgroundColor: '#eff6ff' },
  badgeProcessing: { backgroundColor: '#dbeafe' },
  badgeReady: { backgroundColor: '#1d4ed8' },
  badgeCompleted: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  badgeTextReceived: { color: '#1d4ed8' },
  badgeTextProcessing: { color: '#1e40af' },
  badgeTextReady: { color: '#ffffff' },
  customer: { color: '#0f172a', fontSize: 14, fontWeight: '600', marginTop: 4 },
  service: { color: '#64748b', fontSize: 12, marginTop: 2 },
  agingText: { color: '#1d4ed8', fontSize: 11, fontWeight: '600', marginTop: 4 },
  agingTextUrgent: { color: '#c2410c' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  price: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  balance: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptySubtitle: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
