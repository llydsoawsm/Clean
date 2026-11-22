import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { listServices } from '@/db/repositories/services';
import type { ServiceRow } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { EmptyState, LoadingState } from '@/components/Feedback';

function priceLabel(row: ServiceRow): string {
  const base = formatPHP(row.unit_price_centavos);
  if (row.pricing_type === 'per_load') {
    const blockKg = row.weight_block_grams ? row.weight_block_grams / 1000 : 8;
    return `${base} / ${blockKg}kg`;
  }
  if (row.pricing_type === 'per_kg') return `${base}/kg`;
  if (row.pricing_type === 'per_piece') return `${base}/piece`;
  return `${base} fixed`;
}

export default function ServicesScreen() {
  const session = useAuthSession();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const rows = await listServices(session.shop.id, true);
      setServices(rows);
    } catch (e) {
      console.warn('[Services] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const displayed = showInactive ? services : services.filter((s) => s.is_active === 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Services</Text>
        <Pressable onPress={() => router.push('/service-add' as any)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#1d4ed8" />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Pressable onPress={() => setShowInactive(false)} style={[styles.chip, !showInactive && styles.chipActive]}>
          <Text style={[styles.chipText, !showInactive && styles.chipTextActive]}>Active</Text>
        </Pressable>
        <Pressable onPress={() => setShowInactive(true)} style={[styles.chip, showInactive && styles.chipActive]}>
          <Text style={[styles.chipText, showInactive && styles.chipTextActive]}>All Services</Text>
        </Pressable>
      </View>

      {loading ? (
        <LoadingState message="Loading services..." />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No Services Found"
              hint="Add laundry services (per load, per kg, per piece, or fixed) to receive orders."
              actionLabel="Add Service"
              onAction={() => router.push('/service-add' as any)}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/service-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{priceLabel(item)}</Text>
              </View>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <View style={styles.footerRow}>
                <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.is_active ? 'Active' : 'Archived'}
                  </Text>
                </View>
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
  addBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
  cardPressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { color: '#0f172a', fontSize: 14, fontWeight: '600', flex: 1 },
  price: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
  desc: { color: '#64748b', fontSize: 12, marginTop: 4 },
  footerRow: { marginTop: 8 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusActive: { backgroundColor: '#eff6ff' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '500' },
  statusTextActive: { color: '#1d4ed8' },
  statusTextInactive: { color: '#64748b' },
});
