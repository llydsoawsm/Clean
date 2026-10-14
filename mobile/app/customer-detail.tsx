import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { customerStore } from '@/store/customerStore';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = id ? customerStore.getById(id) : undefined;

  const [name, setName] = useState(customer?.name ?? 'Maria Santos');
  const [contact, setContact] = useState(customer?.contact_number ?? '0917-123-4567');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setContact(customer.contact_number ?? '');
      setAddress(customer.address ?? '');
      setNotes(customer.notes ?? '');
    }
  }, [customer]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Customer name is required.');
      return;
    }
    if (id) {
      customerStore.update(id, {
        name: name.trim(),
        contact_number: contact.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }
    Alert.alert('Saved', 'Customer profile updated successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Customer', `Are you sure you want to remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (id) customerStore.delete(id);
          router.back();
        },
      },
    ]);
  };

  const handleCreateOrder = () => {
    if (id) {
      router.push({ pathname: '/receive' as any, params: { customerId: id } });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Customer Profile</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.card}>
          <Pressable onPress={handleCreateOrder} style={styles.orderActionBtn}>
            <Ionicons name="add-circle" size={18} color="#ffffff" />
            <Text style={styles.orderActionText}>New Laundry Order for {name.split(' ')[0]}</Text>
          </Pressable>

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          <Text style={styles.label}>Contact Number (Optional)</Text>
          <TextInput style={styles.input} value={contact} onChangeText={setContact} keyboardType="phone-pad" placeholder="0917-000-0000 (Optional)" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Address (Optional)</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline />

          <Pressable onPress={handleSave} style={styles.button}>
            <Text style={styles.buttonText}>Save Changes</Text>
          </Pressable>

          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete Customer</Text>
          </Pressable>
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  orderActionBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  orderActionText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  deleteButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  deleteText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
});
