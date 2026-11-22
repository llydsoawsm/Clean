import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase } from '@/db/client';
import { deleteCustomer, getCustomerById, updateCustomer } from '@/db/repositories/customers';
import { LoadingState, EmptyState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        await initDatabase();
        const customer = await getCustomerById(id);
        if (cancelled) return;
        if (!customer) {
          setNotFound(true);
        } else {
          setName(customer.name);
          setContact(customer.contact_number);
          setAddress(customer.address ?? '');
          setNotes(customer.notes ?? '');
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Customer name is required.');
      return;
    }
    if (!contact.trim()) {
      Alert.alert('Required', 'Contact number is required.');
      return;
    }

    setSaving(true);
    try {
      await updateCustomer(id, {
        name: name.trim(),
        contact_number: contact.trim(),
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      toast.show('Customer updated', 'success');
      router.back();
    } catch (e) {
      Alert.alert('Update Failed', e instanceof Error ? e.message : 'Unable to update customer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Customer', `Are you sure you want to remove ${name}? Historical orders will be preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer(id);
            toast.show('Customer removed', 'info');
            router.back();
          } catch (e) {
            Alert.alert('Delete Failed', e instanceof Error ? e.message : 'Unable to delete customer.');
          }
        },
      },
    ]);
  };

  const handleCreateOrder = () => {
    if (id) {
      router.push({ pathname: '/receive' as any, params: { customerId: id } });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading customer..." />
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Customer Profile</Text>
          <View style={{ width: 50 }} />
        </View>
        <EmptyState title="Customer Not Found" hint="This customer may have been removed." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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

            <Text style={styles.label}>Contact Number *</Text>
            <TextInput
              style={styles.input}
              value={contact}
              onChangeText={setContact}
              keyboardType="phone-pad"
              placeholder="0917-000-0000"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Address (Optional)</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} />

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline />

            <Pressable onPress={handleSave} disabled={saving} style={[styles.button, saving && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>

            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Delete Customer</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  deleteButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  deleteText: { color: '#dc2626', fontSize: 13, fontWeight: '500' },
});
