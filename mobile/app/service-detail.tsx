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
import { getServiceById, softDeleteService, updateService } from '@/db/repositories/services';
import type { PricingType } from '@/db/types';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';

const pricingOptions: { value: PricingType; label: string }[] = [
  { value: 'per_load', label: 'Per Load' },
  { value: 'per_kg', label: 'Per Kg' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'fixed', label: 'Fixed Price' },
];

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('per_kg');
  const [price, setPrice] = useState('0.00');
  const [weightBlockKg, setWeightBlockKg] = useState('8');
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');

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
        const s = await getServiceById(id);
        if (cancelled) return;
        if (!s) {
          setNotFound(true);
        } else {
          setName(s.name);
          setPricingType(s.pricing_type);
          setPrice((s.unit_price_centavos / 100).toFixed(2));
          setWeightBlockKg(s.weight_block_grams ? String(s.weight_block_grams / 1000) : '8');
          setIsActive(s.is_active === 1);
          setDescription(s.description ?? '');
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
      Alert.alert('Required', 'Please enter a service name.');
      return;
    }
    const val = parseFloat(price);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid rate.');
      return;
    }
    let weightBlockGrams: number | null = null;
    if (pricingType === 'per_load') {
      const blockKgVal = parseFloat(weightBlockKg);
      if (isNaN(blockKgVal) || blockKgVal < 1 || blockKgVal > 50) {
        Alert.alert('Invalid Weight Block', 'Max weight per load must be between 1 and 50 kg.');
        return;
      }
      weightBlockGrams = Math.round(blockKgVal * 1000);
    }

    setSaving(true);
    try {
      await updateService(id, {
        name: name.trim(),
        pricing_type: pricingType,
        unit_price_centavos: Math.round(val * 100),
        weight_block_grams: weightBlockGrams,
        is_active: isActive ? 1 : 0,
        description: description.trim() || null,
      });
      toast.show('Service updated', 'success');
      router.back();
    } catch (e) {
      Alert.alert('Update Failed', e instanceof Error ? e.message : 'Unable to update service.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Service', 'Are you sure you want to delete this service? Historical orders keep their original price snapshot.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await softDeleteService(id);
            toast.show('Service deleted', 'info');
            router.back();
          } catch (e) {
            Alert.alert('Delete Failed', e instanceof Error ? e.message : 'Unable to delete service.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading service..." />
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
          <Text style={styles.title}>Service Details</Text>
          <View style={{ width: 50 }} />
        </View>
        <EmptyState title="Service Not Found" hint="This service may have been removed." />
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
            <Text style={styles.title}>Service Details</Text>
            <View style={{ width: 50 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Service Name *</Text>
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

            <Text style={styles.label}>Rate (₱) *</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

            {pricingType === 'per_load' && (
              <>
                <Text style={styles.label}>Max Weight per Load (kg, 1–50)</Text>
                <TextInput
                  style={styles.input}
                  value={weightBlockKg}
                  onChangeText={setWeightBlockKg}
                  keyboardType="decimal-pad"
                  placeholder="8"
                  placeholderTextColor="#94a3b8"
                />
              </>
            )}

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

            <Pressable onPress={handleSave} disabled={saving} style={[styles.button, saving && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>

            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Delete Service</Text>
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  deleteButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  deleteText: { color: '#dc2626', fontSize: 13, fontWeight: '500' },
});
