import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { createCustomer } from '@/db/repositories/customers';

export default function CustomerAddScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setError(null);
    const n = name.trim();
    const c = contact.trim();
    if (!n) {
      setError('Customer name is required.');
      return;
    }
    if (!c) {
      setError('Contact number is required.');
      return;
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test(c)) {
      setError('Invalid contact number format (7-20 digits, + - () space allowed).');
      return;
    }
    if (!shopId) {
      setError('Shop not found. Please re-login.');
      return;
    }
    setLoading(true);
    try {
      await createCustomer({ shop_id: shopId, name: n, contact_number: c, address: address.trim() || null, notes: notes.trim() || null });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Add Customer</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} placeholder="Juan Dela Cruz" value={name} onChangeText={setName} editable={!loading} />

          <Text style={styles.label}>Contact Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="09xxxxxxxxx"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <Text style={styles.label}>Address (optional)</Text>
          <TextInput style={styles.input} placeholder="Barangay, City" value={address} onChangeText={setAddress} editable={!loading} />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput style={[styles.input, styles.multiline]} placeholder="Allergy, prefers... " value={notes} onChangeText={setNotes} multiline numberOfLines={3} editable={!loading} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleSave} disabled={loading} style={[styles.button, loading && styles.buttonDisabled]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Customer</Text>}
          </Pressable>
          <Text style={styles.hint}>Saved locally first (sync_status=PENDING). Works offline.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  title: { color: '#172554', fontSize: 18, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12, lineHeight: 18 },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 16, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { color: '#64748b', fontSize: 11, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
});
