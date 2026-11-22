import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { createService, listServices } from '@/db/repositories/services';
import type { PricingType } from '@/db/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import {
  AppButton,
  Card,
  FormField,
  FormInput,
  OptionChips,
  useScreenBottomPadding,
} from '@/components/ui';
import { theme, typography } from '@/theme';

type ServicePreset = {
  name: string;
  pricingType: PricingType;
  price: string;
  weightBlockKg: string;
  description: string;
};

const DEFAULT_SERVICE_PRESETS: ServicePreset[] = [
  {
    name: 'Wash & Fold',
    pricingType: 'per_load',
    price: '160',
    weightBlockKg: '8',
    description: 'Wash, dry & fold (detergent and fabcon included)',
  },
  {
    name: 'Wash & Dry',
    pricingType: 'per_load',
    price: '130',
    weightBlockKg: '8',
    description: 'Wash & tumble dry, self-fold',
  },
  {
    name: 'Wash, Dry & Press',
    pricingType: 'per_kg',
    price: '45',
    weightBlockKg: '8',
    description: 'Washed, dried, and steam pressed',
  },
  {
    name: 'Comforter & Bedding',
    pricingType: 'per_piece',
    price: '180',
    weightBlockKg: '8',
    description: 'Blankets, comforters, and bedsheets',
  },
  {
    name: 'Dry Cleaning',
    pricingType: 'per_piece',
    price: '150',
    weightBlockKg: '8',
    description: 'Barong, suit, gown, or delicate wear',
  },
  {
    name: 'Express Load',
    pricingType: 'fixed',
    price: '220',
    weightBlockKg: '8',
    description: 'Same-day priority wash & fold',
  },
];

const DEFAULT_PRICE_BY_TYPE: Record<PricingType, string> = {
  per_load: '160',
  per_kg: '35',
  per_piece: '150',
  fixed: '200',
};

const KNOWN_DEFAULT_PRICES = new Set([
  ...Object.values(DEFAULT_PRICE_BY_TYPE),
  ...DEFAULT_SERVICE_PRESETS.map((p) => p.price),
]);

const pricingOptions: { key: PricingType; label: string }[] = [
  { key: 'per_load', label: 'Per Load' },
  { key: 'per_kg', label: 'Per Kilo' },
  { key: 'per_piece', label: 'Per Piece' },
  { key: 'fixed', label: 'Fixed' },
];

export default function ServiceAddScreen() {
  const session = useAuthSession();
  const toast = useToast();
  const bottomPadding = useScreenBottomPadding();

  const initialPreset = DEFAULT_SERVICE_PRESETS[0];
  const [name, setName] = useState(initialPreset.name);
  const [pricingType, setPricingType] = useState<PricingType>(initialPreset.pricingType);
  const [price, setPrice] = useState(initialPreset.price);
  const [weightBlockKg, setWeightBlockKg] = useState(initialPreset.weightBlockKg);
  const [description, setDescription] = useState(initialPreset.description);
  const [existingNames, setExistingNames] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const userEditedRef = useRef(false);

  const applyPreset = (preset: ServicePreset, markEdited: boolean) => {
    if (markEdited) userEditedRef.current = true;
    setName(preset.name);
    setPricingType(preset.pricingType);
    setPrice(preset.price);
    setWeightBlockKg(preset.weightBlockKg);
    setDescription(preset.description);
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        const rows = await listServices(session.shop.id, true);
        if (cancelled) return;
        const used = new Set(rows.map((r) => r.name.trim().toLowerCase()));
        setExistingNames(used);

        if (!userEditedRef.current && used.has(DEFAULT_SERVICE_PRESETS[0].name.toLowerCase())) {
          const nextUnused = DEFAULT_SERVICE_PRESETS.find(
            (p) => !used.has(p.name.toLowerCase())
          );
          if (nextUnused) {
            applyPreset(nextUnused, false);
          }
        }
      } catch (e) {
        console.warn('[ServiceAdd] preset load error:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.shop.id]);

  const handleSelectPricingType = (nextType: PricingType) => {
    userEditedRef.current = true;
    setPricingType(nextType);
    if (!price.trim() || KNOWN_DEFAULT_PRICES.has(price.trim())) {
      setPrice(DEFAULT_PRICE_BY_TYPE[nextType]);
    }
  };

  const handleSave = async () => {
    if (!session) {
      Alert.alert('Sign In Required', 'Please sign in first.');
      return;
    }
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
      await initDatabase();
      await createService({
        shop_id: session.shop.id,
        name: name.trim(),
        pricing_type: pricingType,
        unit_price_centavos: Math.round(val * 100),
        weight_block_grams: weightBlockGrams,
        description: description.trim() || null,
      });
      toast.show('Service saved', 'success');
      router.back();
    } catch (e) {
      Alert.alert('Cannot Save', e instanceof Error ? e.message : 'Unable to save service.');
    } finally {
      setSaving(false);
    }
  };

  const normalizedName = name.trim().toLowerCase();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="New Service" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.presetLabel}>Presets</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}
          >
            {DEFAULT_SERVICE_PRESETS.map((preset) => {
              const isSelected = normalizedName === preset.name.toLowerCase();
              const alreadyAdded = existingNames.has(preset.name.toLowerCase());
              return (
                <Pressable
                  key={preset.name}
                  onPress={() => applyPreset(preset, true)}
                  style={({ pressed }) => [
                    styles.presetChip,
                    isSelected && styles.presetChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  {alreadyAdded ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={14}
                      color={isSelected ? theme.colors.brand : theme.colors.claimed}
                    />
                  ) : null}
                  <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                    {preset.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Card>
            <FormField label="Name" first>
              <FormInput
                placeholder="e.g. Wash & Fold"
                value={name}
                onChangeText={(val) => {
                  userEditedRef.current = true;
                  setName(val);
                }}
              />
            </FormField>

            <FormField label="Pricing">
              <OptionChips
                options={pricingOptions}
                value={pricingType}
                onChange={handleSelectPricingType}
                layout="wrap"
              />
            </FormField>

            <FormField label="Price (₱)">
              <FormInput
                placeholder="0.00"
                value={price}
                onChangeText={(val) => {
                  userEditedRef.current = true;
                  setPrice(val);
                }}
                keyboardType="decimal-pad"
              />
            </FormField>

            {pricingType === 'per_load' ? (
              <FormField label="Max kg / load">
                <FormInput
                  placeholder="8"
                  value={weightBlockKg}
                  onChangeText={(val) => {
                    userEditedRef.current = true;
                    setWeightBlockKg(val);
                  }}
                  keyboardType="decimal-pad"
                />
              </FormField>
            ) : null}

            <FormField label="Note">
              <FormInput
                placeholder="Detergent included, etc."
                value={description}
                onChangeText={(val) => {
                  userEditedRef.current = true;
                  setDescription(val);
                }}
                multiline
              />
            </FormField>

            <AppButton
              variant="primary"
              label={saving ? 'Saving...' : 'Save'}
              onPress={handleSave}
              loading={saving}
              style={styles.submitBtn}
            />
          </Card>
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
  presetLabel: {
    ...typography.label,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: theme.spacing.md,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetChipActive: {
    backgroundColor: theme.colors.brandSoft,
    borderColor: theme.colors.brand,
  },
  presetText: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  presetTextActive: {
    color: theme.colors.brand,
    fontWeight: '700',
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  submitBtn: {
    marginTop: theme.spacing.xl,
  },
});
