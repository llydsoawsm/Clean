import { useState, useEffect } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PricingType } from '@/db/types';
import { serviceStore } from '@/store/serviceStore';

const pricingOptions: { value: PricingType; label: string }[] = [
  { value: 'per_load', label: 'Per Load' },
  { value: 'per_kg', label: 'Per Kg' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'fixed', label: 'Fixed Price' },
];

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const initial = id ? serviceStore.getById(id) : undefined;

  const [name, setName] = useState(initial?.name || 'Wash & Fold');
  const [pricingType, setPricingType] = useState<PricingType>(initial?.pricing_type || 'per_kg');
  const [price, setPrice] = useState(initial ? (initial.unit_price_centavos / 100).toFixed(2) : '35.00');
  const [isActive, setIsActive] = useState(initial ? initial.is_active === 1 : true);
  const [description, setDescription] = useState(initial?.description || '');

  useEffect(() => {
    if (id) {
      const s = serviceStore.getById(id);
      if (s) {
        setName(s.name);
        setPricingType(s.pricing_type);
        setPrice((s.unit_price_centavos / 100).toFixed(2));
        setIsActive(s.is_active === 1);
        setDescription(s.description || '');
      }
    }
  }, [id]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a service name.');
      return;
    }
    const val = parseFloat(price);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid rate.');
      return;
    }
    if (id) {
      serviceStore.update(id, {
        name: name.trim(),
        pricing_type: pricingType,
        unit_price_centavos: Math.round(val * 100),
        is_active: isActive ? 1 : 0,
        description: description.trim() || undefined,
      });
    }
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('Delete Service', 'Are you sure you want to delete this service?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (id) serviceStore.delete(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Service Details</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Service Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          <Text style={styles.label}>Pricing Model</Text>
          <View style={styles.optionRow}>
            {pricingOptions.map((opt) => {
              const active = pricingType === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setPricingType(opt.value)}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Rate (₱)</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline />

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Status</Text>
            <Pressable
              onPress={() => setIsActive(!isActive)}
              style={[styles.statusToggle, isActive ? styles.statusActive : styles.statusInactive]}
            >
              <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                {isActive ? 'Active' : 'Archived'}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={handleSave} style={styles.button}>
            <Text style={styles.buttonText}>Save Changes</Text>
          </Pressable>

          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete Service</Text>
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
  label: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 12 },
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
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  optionChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
  },
  optionChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  optionText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  optionTextActive: { color: '#ffffff', fontWeight: '600' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusActive: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  statusInactive: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextActive: { color: '#1d4ed8' },
  statusTextInactive: { color: '#64748b' },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  deleteButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  deleteText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
});
