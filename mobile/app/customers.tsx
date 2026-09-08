import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { searchCustomers } from '@/db/repositories/customers';
import type { CustomerRow } from '@/db/types';

export default function CustomersScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await searchCustomers(query.trim(), shopId);
      setCustomers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query, shopId]);

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
        <Text style={styles.title}>Customers</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search name or contact"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#3157d5" />
          <Text style={styles.hint}>Loading customers...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No customers yet</Text>
          <Text style={styles.emptyHint}>Tap Add Customer to create the first one. Works offline.</Text>
          <Pressable onPress={() => router.push('/customer-add' as any)} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Add Customer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/customer-detail' as any, params: { id: item.id } })}
              style={styles.card}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.contact}>{item.contact_number}</Text>
              {item.address ? <Text style={styles.meta}>{item.address}</Text> : null}
              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              <Text style={styles.metaSmall}>Tap to view • {item.sync_status} • {new Date(item.updated_at).toLocaleDateString()}</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={() => router.push('/customer-add' as any)} style={styles.fab}>
        <Text style={styles.fabText}>＋ Add Customer</Text>
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
  searchBox: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12 },
  searchInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  retryButton: { backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  retryText: { color: '#1e293b', fontWeight: '600' },
  emptyTitle: { color: '#1e293b', fontSize: 16, fontWeight: '700' },
  emptyHint: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  primaryButton: { backgroundColor: '#3157d5', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8 },
  name: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  contact: { color: '#3157d5', fontSize: 13, marginTop: 2, fontWeight: '600' },
  meta: { color: '#475569', fontSize: 12, marginTop: 4 },
  metaSmall: { color: '#94a3b8', fontSize: 10, marginTop: 6 },
  notes: { color: '#334155', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  fab: { position: 'absolute', bottom: 20, right: 16, left: 16, backgroundColor: '#172554', borderRadius: 12, padding: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
