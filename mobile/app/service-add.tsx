import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PricingType } from '@/db/types';
import { serviceStore } from '@/store/serviceStore';

const pricingOptions: { value: PricingType; label: string }[] = [
  { value: 'per_load', label: 'Per Load' },
  { value: 'per_kg', label: 'Per Kg' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'fixed', label: 'Fixed Price' },
];

export default function ServiceAddScreen() {
  const [name, setName] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('per_load');
  const [price, setPrice] = useState('160');
  const [weightBlockKg, setWeightBlockKg] = useState('8');
  const [description, setDescription] = useState('');

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
    const unitPriceCentavos = Math.round(val * 100);
    const blockKgVal = parseFloat(weightBlockKg);
    const weightBlockGrams = pricingType === 'per_load' && !isNaN(blockKgVal) ? Math.round(blockKgVal * 1000) : undefined;

    serviceStore.create({
      name: name.trim(),
      pricing_type: pricingType,
      unit_price_centavos: unitPriceCentavos,
      weight_block_grams: weightBlockGrams,
      description: description.trim() || undefined,
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
          <Text style={styles.title}>New Service</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Service Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Wash & Fold"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
          />

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
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          {pricingType === 'per_load' && (
            <>
              <Text style={styles.label}>Max Weight per Load (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="8"
                placeholderTextColor="#94a3b8"
                value={weightBlockKg}
                onChangeText={setWeightBlockKg}
                keyboardType="decimal-pad"
              />
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Optional service notes..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Pressable onPress={handleSave} style={styles.button}>
            <Text style={styles.buttonText}>Save Service</Text>
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
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
