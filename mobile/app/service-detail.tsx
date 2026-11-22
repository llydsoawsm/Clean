import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { initDatabase } from '@/db/client';
import { getServiceById, softDeleteService, updateService } from '@/db/repositories/services';
import type { PricingType } from '@/db/types';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import {
  AppButton,
  Card,
  FormField,
  FormInput,
  OptionChips,
  useScreenBottomPadding,
} from '@/components/ui';
import { theme } from '@/theme';

const pricingOptions: { key: PricingType; label: string }[] = [
  { key: 'per_load', label: 'Per Load' },
  { key: 'per_kg', label: 'Per Kilo' },
  { key: 'per_piece', label: 'Per Piece' },
  { key: 'fixed', label: 'Fixed' },
];

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const bottomPadding = useScreenBottomPadding();

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
      Alert.alert('Required', 'Enter a service name.');
      return;
    }
    const val = parseFloat(price);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Price', 'Enter a valid price.');
      return;
    }
    let weightBlockGrams: number | null = null;
    if (pricingType === 'per_load') {
      const blockKgVal = parseFloat(weightBlockKg);
      if (isNaN(blockKgVal) || blockKgVal < 1 || blockKgVal > 50) {
        Alert.alert('Invalid Weight', 'Max kg per load must be between 1 and 50.');
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
    Alert.alert('Delete Service', `Delete ${name}? Past orders keep their saved price.`, [
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
            Alert.alert('Error', e instanceof Error ? e.message : 'Unable to delete service.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Edit Service" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Edit Service" />
        <EmptyState icon="tag-outline" title="Service not found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Edit Service" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <FormField label="Name" first>
              <FormInput value={name} onChangeText={setName} />
            </FormField>

            <FormField label="Pricing">
              <OptionChips
                options={pricingOptions}
                value={pricingType}
                onChange={setPricingType}
                layout="wrap"
              />
            </FormField>

            <FormField label="Price (₱)">
              <FormInput
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </FormField>

            {pricingType === 'per_load' ? (
              <FormField label="Max kg / load">
                <FormInput
                  value={weightBlockKg}
                  onChangeText={setWeightBlockKg}
                  keyboardType="decimal-pad"
                  placeholder="8"
                />
              </FormField>
            ) : null}

            <FormField label="Note">
              <FormInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Detergent included, etc."
              />
            </FormField>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Status</Text>
              <Pressable
                onPress={() => setIsActive(!isActive)}
                hitSlop={8}
                style={({ pressed }) => [pressed && styles.pressed]}
                accessibilityRole="switch"
                accessibilityState={{ checked: isActive }}
              >
                <StatusBadge type="service" value={isActive ? 'ACTIVE' : 'INACTIVE'} />
              </Pressable>
            </View>

            <AppButton
              variant="primary"
              label={saving ? 'Saving...' : 'Save'}
              onPress={handleSave}
              loading={saving}
              style={styles.submitBtn}
            />
          </Card>

          <AppButton
            variant="dangerSoft"
            size="md"
            icon="trash-can-outline"
            label="Delete service"
            onPress={handleDelete}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  toggleLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  submitBtn: {
    marginTop: theme.spacing.xl,
  },
});
