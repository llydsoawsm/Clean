import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { createService } from '@/db/repositories/services';
import type { PricingType } from '@/db/types';

const pricingOptions: { value: PricingType; label: string; hint: string }[] = [
  { value: 'per_load', label: 'Per load (package)', hint: '₱ per load' },
  { value: 'per_kg', label: 'Per kilogram', hint: '₱/kg' },
  { value: 'per_piece', label: 'Per piece', hint: '₱/piece' },
  { value: 'fixed', label: 'Fixed price', hint: '₱' },
];

export default function ServiceAddScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;
  const [name, setName] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('per_load');
  const [price, setPrice] = useState('160');
  const [weightBlockKg, setWeightBlockKg] = useState('8');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setError(null);
    const n = name.trim();
    if (!n) {
      setError('Service name is required.');
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) {
      setError('Price must be a number ≥ 0');
      return;
    }
    let blockGrams: number | null = null;
    if (pricingType === 'per_load') {
      const blockKg = parseFloat(weightBlockKg);
      if (isNaN(blockKg) || blockKg < 1 || blockKg > 50) {
        setError('Weight per load must be 1-50 kg');
        return;
      }
      blockGrams = Math.round(blockKg * 1000);
    }
    if (!shopId) {
      setError('Shop not found');
      return;
    }
    setLoading(true);
    try {
      await createService({
        shop_id: shopId,
        name: n,
        pricing_type: pricingType,
        unit_price_centavos: Math.round(p * 100),
        description: description.trim() || null,
        weight_block_grams: blockGrams,
        is_active: true,
      });
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
          <Text style={styles.title}>Add Service</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Service Name *</Text>
          <TextInput style={styles.input} placeholder="Wash & Dry" value={name} onChangeText={setName} editable={!loading} />

          <Text style={styles.label}>Pricing Type *</Text>
          <View style={styles.chipRow}>
            {pricingOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPricingType(opt.value)}
                style={[styles.chip, pricingType === opt.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, pricingType === opt.value && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Price (₱) *</Text>
          <TextInput
            style={styles.input}
            placeholder={pricingType === 'per_load' ? '160' : '70'}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            editable={!loading}
          />
          <Text style={styles.hint}>
            {pricingType === 'per_load'
              ? `Stored as ${price || 160}00 centavos per ${weightBlockKg || 8}kg load. Example: 160 → ₱160.00 per 8kg`
              : `Stored as centavos. Example: 70 → ₱70.00 ${pricingOptions.find((o) => o.value === pricingType)?.hint}`}
          </Text>

          {pricingType === 'per_load' && (
            <>
              <Text style={styles.label}>Weight per load (kg) *</Text>
              <TextInput
                style={styles.input}
                placeholder="8"
                value={weightBlockKg}
                onChangeText={setWeightBlockKg}
                keyboardType="decimal-pad"
                editable={!loading}
              />
              <Text style={styles.hint}>Configurable: e.g., 8 for ₱160/8kg, 10 for ₱200/10kg</Text>
            </>
          )}

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={[styles.input, styles.multiline]} placeholder="Includes wash, dry, fold" value={description} onChangeText={setDescription} multiline numberOfLines={2} editable={!loading} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleSave} disabled={loading} style={[styles.button, loading && styles.buttonDisabled]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Service</Text>}
          </Pressable>
          <Text style={styles.note}>Saved locally (PENDING). Works offline.</Text>
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
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  hint: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12 },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 16, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  note: { color: '#64748b', fontSize: 11, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
});
