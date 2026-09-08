import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getCustomerById, updateCustomer, deleteCustomer } from '@/db/repositories/customers';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!id) return;
        const row = await getCustomerById(id as string);
        if (!row) {
          if (!cancelled) setError('Customer not found');
          return;
        }
        if (!cancelled) {
          setName(row.name);
          setContact(row.contact_number);
          setAddress(row.address ?? '');
          setNotes(row.notes ?? '');
          setInfo(`Created ${new Date(row.created_at).toLocaleString()} • ${row.sync_status}`);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    setError(null);
    const n = name.trim();
    const c = contact.trim();
    if (!n) {
      setError('Customer name is required.');
      return;
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test(c)) {
      setError('Invalid contact number format.');
      return;
    }
    setSaving(true);
    try {
      await updateCustomer(id as string, { name: n, contact_number: c, address: address.trim() || null, notes: notes.trim() || null });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete Customer', 'Delete this customer? It will disappear from active lists but historical orders remain. This works offline and will sync.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteCustomer(id as string);
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#3157d5" />
          <Text style={styles.hint}>Loading customer...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Customer Details</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.card}>
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} editable={!saving} />

          <Text style={styles.label}>Contact *</Text>
          <TextInput style={styles.input} value={contact} onChangeText={setContact} keyboardType="phone-pad" editable={!saving} />

          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} editable={!saving} />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline numberOfLines={3} editable={!saving} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleSave} disabled={saving} style={[styles.button, saving && styles.buttonDisabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
          </Pressable>
          <Text style={styles.hint}>Edits saved locally (PENDING) — works offline.</Text>

          <Pressable onPress={handleDelete} disabled={saving} style={[styles.deleteButton, saving && styles.buttonDisabled]}>
            <Text style={styles.deleteText}>Delete Customer</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  title: { color: '#172554', fontSize: 18, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  info: { color: '#64748b', fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12 },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 16, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteButton: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, marginTop: 12, padding: 14, alignItems: 'center' },
  deleteText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
});
