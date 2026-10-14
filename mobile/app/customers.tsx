import { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { customerStore, CustomerItem } from '@/store/customerStore';

export default function CustomersScreen() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerItem[]>(customerStore.getAll());

  useEffect(() => {
    const unsub = customerStore.subscribe(() => {
      setCustomers(customerStore.search(query));
    });
    return unsub;
  }, [query]);

  useEffect(() => {
    setCustomers(customerStore.search(query));
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Customers</Text>
        <Pressable onPress={() => router.push('/customer-add' as any)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#1d4ed8" />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search customer by name or contact"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => router.push({ pathname: '/customer-detail' as any, params: { id: item.id } })}
              style={styles.cardMain}
            >
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={18} color="#1d4ed8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.contact_number ? <Text style={styles.contact}>{item.contact_number}</Text> : null}
                  {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
                </View>
              </View>
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => router.push({ pathname: '/receive' as any, params: { customerId: item.id } })}
                style={styles.newOrderBtn}
              >
                <Ionicons name="add-circle-outline" size={14} color="#1d4ed8" />
                <Text style={styles.newOrderText}>New Order</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push({ pathname: '/customer-detail' as any, params: { id: item.id } })}
                style={styles.detailsBtn}
              >
                <Text style={styles.detailsText}>Profile</Text>
                <Ionicons name="chevron-forward" size={14} color="#64748b" />
              </Pressable>
            </View>
          </View>
        )}
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
  listContent: { padding: 18, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardMain: { marginBottom: 10 },
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  name: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  contact: { color: '#1d4ed8', fontSize: 13, marginTop: 2, fontWeight: '500' },
  address: { color: '#64748b', fontSize: 12, marginTop: 3 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  newOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  newOrderText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailsText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
});
