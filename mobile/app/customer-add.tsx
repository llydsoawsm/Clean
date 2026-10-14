import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { customerStore } from '@/store/customerStore';

export default function CustomerAddScreen() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter customer name.');
      return;
    }

    customerStore.add({
      name: name.trim(),
      contact_number: contact.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Add Customer</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Contact Number (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="0917-000-0000 (Optional)"
            placeholderTextColor="#94a3b8"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Address (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Street or Barangay"
            placeholderTextColor="#94a3b8"
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Preferences, special instructions..."
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Pressable onPress={handleSave} style={styles.button}>
            <Text style={styles.buttonText}>Save Customer</Text>
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
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
