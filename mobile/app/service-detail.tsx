import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getServiceById, updateService, softDeleteService } from '@/db/repositories/services';
import type { PricingType } from '@/db/types';

const pricingOptions: { value: PricingType; label: string }[] = [
  { value: 'per_load', label: 'Per load (package)' },
  { value: 'per_kg', label: 'Per kilogram' },
  { value: 'per_piece', label: 'Per piece' },
  { value: 'fixed', label: 'Fixed price' },
];

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('per_kg');
  const [price, setPrice] = useState('');
  const [weightBlockKg, setWeightBlockKg] = useState('8');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!id) return;
        const row = await getServiceById(id as string);
        if (!row) {
          if (!cancelled) setError('Service not found');
          return;
        }
        if (!cancelled) {
          setName(row.name);
          setPricingType(row.pricing_type);
          setPrice((row.unit_price_centavos / 100).toString());
          setDescription(row.description ?? '');
          setIsActive(!!row.is_active);
          if (row.weight_block_grams) setWeightBlockKg((row.weight_block_grams / 1000).toString());
          setInfo(`${row.is_active ? 'Active' : 'Inactive'} • ${row.sync_status} • ${new Date(row.updated_at).toLocaleString()}`);
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
    if (!n) {
      setError('Service name is required.');
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) {
      setError('Price must be ≥ 0');
      return;
    }
    let blockGrams: number | null = null;
    if (pricingType === 'per_load') {
      const b = parseFloat(weightBlockKg);
      if (isNaN(b) || b < 1 || b > 50) {
        setError('Weight per load must be 1-50 kg');
        return;
      }
      blockGrams = Math.round(b * 1000);
    }
    setSaving(true);
    try {
      await updateService(id as string, {
        name: n,
        pricing_type: pricingType,
        unit_price_centavos: Math.round(p * 100),
        description: description.trim() || null,
        weight_block_grams: blockGrams,
        is_active: isActive ? 1 : 0,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete Service', 'Delete this service? It will no longer be selectable for new orders. Historical orders remain (snapshots preserved). Works offline and will sync.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await softDeleteService(id as string);
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
          <Text style={styles.hint}>Loading...</Text>
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
          <Text style={styles.title}>Edit Service</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.card}>
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Text style={styles.label}>Service Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} editable={!saving} />

          <Text style={styles.label}>Pricing Type *</Text>
          <View style={styles.chipRow}>
            {pricingOptions.map((opt) => (
              <Pressable key={opt.value} onPress={() => setPricingType(opt.value)} style={[styles.chip, pricingType === opt.value && styles.chipActive]}>
                <Text style={[styles.chipText, pricingType === opt.value && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Price (₱) *</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" editable={!saving} />
          {pricingType === 'per_load' && (
            <>
              <Text style={styles.label}>Weight per load (kg) *</Text>
              <TextInput style={styles.input} value={weightBlockKg} onChangeText={setWeightBlockKg} keyboardType="decimal-pad" editable={!saving} />
              <Text style={styles.hint}>e.g., 8 for ₱160/8kg, 10 for ₱200/10kg</Text>
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline editable={!saving} />

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Status</Text>
            <Pressable onPress={() => setIsActive(!isActive)} style={[styles.toggle, isActive ? styles.toggleActive : styles.toggleInactive]}>
              <Text style={styles.toggleText}>{isActive ? 'Active' : 'Inactive'}</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Inactive services stay stored but hidden from future order screens.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleSave} disabled={saving} style={[styles.button, saving && styles.buttonDisabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
          </Pressable>

          <Pressable onPress={handleDelete} disabled={saving} style={[styles.deleteButton, saving && styles.buttonDisabled]}>
            <Text style={styles.deleteText}>Delete Service</Text>
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
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  toggle: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  toggleActive: { backgroundColor: '#dcfce7' },
  toggleInactive: { backgroundColor: '#fee2e2' },
  toggleText: { fontWeight: '700', color: '#1e293b' },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12 },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 16, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteButton: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, marginTop: 12, padding: 14, alignItems: 'center' },
  deleteText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
});
