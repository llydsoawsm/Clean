import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { listServices } from '@/db/repositories/services';
import type { ServiceRow } from '@/db/types';

function priceLabel(row: ServiceRow): string {
  const price = row.unit_price_centavos / 100;
  if (row.pricing_type === 'per_load') {
    const blockKg = row.weight_block_grams ? row.weight_block_grams / 1000 : 8;
    return `₱${price.toFixed(2)} / ${blockKg}kg`;
  }
  const unit = row.pricing_type === 'per_kg' ? '/kg' : row.pricing_type === 'per_piece' ? '/piece' : '';
  return `₱${price.toFixed(2)}${unit}`;
}
function typeLabel(t: string): string {
  if (t === 'per_kg') return 'Per kilogram';
  if (t === 'per_piece') return 'Per piece';
  if (t === 'per_load') return 'Per load';
  return 'Fixed price';
}

export default function ServicesScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listServices(shopId, showInactive);
      setServices(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [shopId, showInactive]);

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
        <Text style={styles.title}>Services & Rates</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.filterRow}>
        <Pressable onPress={() => setShowInactive(false)} style={[styles.chip, !showInactive && styles.chipActive]}>
          <Text style={[styles.chipText, !showInactive && styles.chipTextActive]}>Active</Text>
        </Pressable>
        <Pressable onPress={() => setShowInactive(true)} style={[styles.chip, showInactive && styles.chipActive]}>
          <Text style={[styles.chipText, showInactive && styles.chipTextActive]}>All (incl. Inactive)</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#3157d5" />
          <Text style={styles.hint}>Loading services...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : services.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No services yet</Text>
          <Text style={styles.emptyHint}>Create Wash & Dry, Comforter, etc. Works offline.</Text>
          <Pressable onPress={() => router.push('/service-add' as any)} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Add Service</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/service-detail' as any, params: { id: item.id } })} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.badge, item.is_active ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={styles.badgeText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <Text style={styles.price}>{priceLabel(item)}</Text>
              <Text style={styles.type}>{typeLabel(item.pricing_type)}</Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <Text style={styles.metaSmall}>{item.sync_status} • {new Date(item.updated_at).toLocaleDateString()}</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={() => router.push('/service-add' as any)} style={styles.fab}>
        <Text style={styles.fabText}>＋ Add Service</Text>
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
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#0f172a', fontSize: 15, fontWeight: '700', flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  price: { color: '#3157d5', fontSize: 15, fontWeight: '800', marginTop: 4 },
  type: { color: '#475569', fontSize: 12, marginTop: 2 },
  desc: { color: '#334155', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  metaSmall: { color: '#94a3b8', fontSize: 10, marginTop: 6 },
  fab: { position: 'absolute', bottom: 20, right: 16, left: 16, backgroundColor: '#172554', borderRadius: 12, padding: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
