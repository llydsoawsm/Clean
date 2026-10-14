import { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { OrderStatus } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { orderStore, LocalOrder } from '@/store/orderStore';

type Filter = 'ALL' | OrderStatus;

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'PROCESSING', label: 'Washing' },
  { key: 'READY', label: 'Ready' },
  { key: 'COMPLETED', label: 'Done' },
];

export default function OrdersScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [orders, setOrders] = useState<LocalOrder[]>(orderStore.getAll());

  useEffect(() => {
    const unsub = orderStore.subscribe(() => {
      setOrders(orderStore.getAll());
    });
    return unsub;
  }, []);

  const counts = orderStore.getCounts();

  const displayedOrders = orders.filter((o) => {
    const matchesFilter = filter === 'ALL' || o.status === filter;
    const matchesSearch =
      !search.trim() ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Minimalist Blue Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Orders ({orders.length})</Text>
        <Pressable onPress={() => router.push('/receive' as any)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#1d4ed8" />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search order or customer"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key];
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={displayedOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>There are currently no laundry orders recorded. Tap + to receive a new order.</Text>
          </View>
        }
        renderItem={({ item }) => {
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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

              <Text style={styles.customer}>{item.customer_name}</Text>
              <Text style={styles.service}>{item.service_name}</Text>

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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
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
