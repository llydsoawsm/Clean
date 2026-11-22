import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getCustomerById, searchCustomers } from '@/db/repositories/customers';
import { listServices } from '@/db/repositories/services';
import { createOrder } from '@/db/repositories/orders';
import type { CustomerRow, PaymentMethod, ServiceRow } from '@/db/types';
import { calcBaseCost, calcBalance, calcLoads, calcTotal, formatPHP } from '@/utils/money';
import { LoadingState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import {
  AppButton,
  Card,
  Divider,
  FormField,
  FormInput,
  KeyValueRow,
  OptionChips,
  SearchBar,
  SectionHeader,
  useScreenBottomPadding,
} from '@/components/ui';
import { avatarTone, getInitials, shortTicket, theme } from '@/theme';

const paymentMethods: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'GCASH', label: 'GCash' },
  { key: 'OTHER', label: 'Other' },
];

function serviceRateLabel(s: ServiceRow): string {
  const rate = formatPHP(s.unit_price_centavos);
  if (s.pricing_type === 'per_load') {
    const kg = s.weight_block_grams ? s.weight_block_grams / 1000 : 8;
    return `${rate} / ${kg}kg`;
  }
  if (s.pricing_type === 'per_kg') return `${rate}/kg`;
  if (s.pricing_type === 'per_piece') return `${rate}/pc`;
  return `${rate} fixed`;
}

export default function ReceiveScreen() {
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const session = useAuthSession();
  const toast = useToast();
  const bottomPadding = useScreenBottomPadding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);

  const defaultRushPesos = session?.shop.rush_fee_centavos
    ? (session.shop.rush_fee_centavos / 100).toString()
    : '50';

  const [weightKg, setWeightKg] = useState('6');
  const [quantity, setQuantity] = useState('1');
  const [additionalFee, setAdditionalFee] = useState('');
  const [rushFee, setRushFee] = useState(defaultRushPesos);
  const [isRush, setIsRush] = useState(false);
  const [amountPaid, setAmountPaid] = useState('0');
  const [paidFull, setPaidFull] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');

  const appliedParamCustomerIdRef = useRef<string | null>(null);
  const customerQueryRef = useRef(customerQuery);
  customerQueryRef.current = customerQuery;

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const [custs, srvs] = await Promise.all([
        searchCustomers(customerQueryRef.current, session.shop.id),
        listServices(session.shop.id, false),
      ]);
      setCustomerResults(custs);
      setServices(srvs);
      setSelectedService((curr) => {
        if (curr && srvs.some((s) => s.id === curr.id)) {
          return srvs.find((s) => s.id === curr.id) ?? null;
        }
        return srvs[0] ?? null;
      });
      if (customerId && appliedParamCustomerIdRef.current !== customerId) {
        const found = await getCustomerById(customerId);
        if (found) {
          setSelectedCustomer(found);
          appliedParamCustomerIdRef.current = customerId;
        }
      }
    } catch (e) {
      console.warn('[Receive] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session, customerId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!session) return;
    void searchCustomers(customerQuery, session.shop.id)
      .then(setCustomerResults)
      .catch(() => {});
  }, [customerQuery, session]);

  const parsedWeightGrams = useMemo(() => {
    const kg = parseFloat(weightKg);
    if (isNaN(kg) || kg <= 0) return null;
    return Math.round(kg * 1000);
  }, [weightKg]);

  const parsedQuantity = useMemo(() => {
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q <= 0) return null;
    return q;
  }, [quantity]);

  const additionalCents = useMemo(() => {
    const v = parseFloat(additionalFee);
    return isNaN(v) || v < 0 ? 0 : Math.round(v * 100);
  }, [additionalFee]);

  const rushCents = useMemo(() => {
    const v = parseFloat(rushFee);
    const base = isNaN(v) || v < 0 ? 0 : Math.round(v * 100);
    return isRush ? base : 0;
  }, [rushFee, isRush]);

  const paidCents = useMemo(() => {
    const v = parseFloat(amountPaid);
    return isNaN(v) || v < 0 ? 0 : Math.round(v * 100);
  }, [amountPaid]);

  const weightBlockGrams = useMemo(() => selectedService?.weight_block_grams ?? 8000, [selectedService]);

  const loads = useMemo(() => {
    if (!selectedService || selectedService.pricing_type !== 'per_load' || !parsedWeightGrams) return 0;
    return calcLoads(parsedWeightGrams, weightBlockGrams);
  }, [selectedService, parsedWeightGrams, weightBlockGrams]);

  const baseCents = useMemo(() => {
    if (!selectedService) return 0;
    return calcBaseCost({
      pricingType: selectedService.pricing_type,
      unitPriceCentavos: selectedService.unit_price_centavos,
      weightGrams: parsedWeightGrams,
      quantity: parsedQuantity,
      weightBlockGrams,
    });
  }, [selectedService, parsedWeightGrams, parsedQuantity, weightBlockGrams]);

  const totalCents = useMemo(() => calcTotal(baseCents, additionalCents, rushCents), [baseCents, additionalCents, rushCents]);

  useEffect(() => {
    if (paidFull) {
      setAmountPaid((totalCents / 100).toFixed(2));
    }
  }, [paidFull, totalCents]);

  const balanceCents = useMemo(() => calcBalance(totalCents, paidCents), [totalCents, paidCents]);
  const isOverpaid = paidCents > totalCents;

  const canCreate = useMemo(() => {
    if (!session || !selectedCustomer || !selectedService) return false;
    if (selectedService.pricing_type === 'per_kg' && !parsedWeightGrams) return false;
    if (selectedService.pricing_type === 'per_load' && !parsedWeightGrams) return false;
    if (selectedService.pricing_type === 'per_piece' && !parsedQuantity) return false;
    if (totalCents <= 0) return false;
    if (paidCents < 0 || paidCents > totalCents) return false;
    return true;
  }, [session, selectedCustomer, selectedService, parsedWeightGrams, parsedQuantity, totalCents, paidCents]);

  const stepAmount = (delta: number) => {
    if (!selectedService) return;
    if (selectedService.pricing_type === 'per_piece') {
      const current = parseInt(quantity, 10);
      const base = isNaN(current) ? 1 : current;
      setQuantity(String(Math.max(1, base + delta)));
      return;
    }
    const current = parseFloat(weightKg);
    const base = isNaN(current) ? 1 : current;
    const next = Math.max(1, Math.round((base + delta) * 10) / 10);
    setWeightKg(String(next));
  };

  const handleCreate = async () => {
    if (!session || !selectedCustomer || !selectedService) {
      Alert.alert('Missing Details', 'Select a customer and service.');
      return;
    }
    if (paidCents > totalCents) {
      Alert.alert('Overpayment', 'Payment cannot exceed total amount.');
      return;
    }

    setSaving(true);
    try {
      const created = await createOrder({
        shop_id: session.shop.id,
        customer_id: selectedCustomer.id,
        customer_name_snapshot: selectedCustomer.name,
        service_id: selectedService.id,
        service_name: selectedService.name,
        pricing_type: selectedService.pricing_type,
        unit_price_centavos: selectedService.unit_price_centavos,
        weight_block_grams: selectedService.pricing_type === 'per_load' ? weightBlockGrams : null,
        weight_grams:
          selectedService.pricing_type === 'per_kg' || selectedService.pricing_type === 'per_load'
            ? parsedWeightGrams
            : null,
        quantity: selectedService.pricing_type === 'per_piece' ? parsedQuantity : null,
        additional_fee_centavos: additionalCents,
        rush_fee_centavos: rushCents,
        is_rush: isRush,
        amount_paid_centavos: paidCents,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null,
        notes: notes.trim() || null,
      });

      toast.show(`Order ${shortTicket(created.order_number)} saved`, 'success');
      router.replace({ pathname: '/order-detail' as any, params: { id: created.id } });
    } catch (e) {
      Alert.alert('Cannot Create Order', e instanceof Error ? e.message : 'Unable to create order.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="New Drop-off" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  const isUnpaidActive = !paidFull && paidCents === 0;
  const isFullActive = paidFull;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="New Drop-off" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Customer */}
          <Card>
            <SectionHeader title="Customer" />
            {selectedCustomer ? (
              <View style={styles.selectedBox}>
                <View style={[styles.avatar, { backgroundColor: avatarTone(selectedCustomer.name).bg }]}>
                  <Text style={[styles.avatarText, { color: avatarTone(selectedCustomer.name).fg }]}>
                    {getInitials(selectedCustomer.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedName} numberOfLines={1}>
                    {selectedCustomer.name}
                  </Text>
                  <Text style={styles.selectedContact}>{selectedCustomer.contact_number}</Text>
                </View>
                <Pressable
                  onPress={() => setSelectedCustomer(null)}
                  style={({ pressed }) => [styles.changeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <SearchBar
                  value={customerQuery}
                  onChangeText={setCustomerQuery}
                  placeholder="Search name or phone"
                  surface="inset"
                />

                <View style={styles.customerList}>
                  {customerResults.length === 0 ? (
                    <Text style={styles.emptyHint}>No match</Text>
                  ) : (
                    customerResults.slice(0, 6).map((c, idx) => {
                      const tone = avatarTone(c.name);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setSelectedCustomer(c)}
                          style={({ pressed }) => [
                            styles.customerRow,
                            idx > 0 && styles.customerRowBorder,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View style={[styles.avatarSmall, { backgroundColor: tone.bg }]}>
                            <Text style={[styles.avatarTextSmall, { color: tone.fg }]}>
                              {getInitials(c.name)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.customerName} numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text style={styles.customerContact}>{c.contact_number}</Text>
                          </View>
                          <Text style={styles.selectLabel}>Select</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>

                <AppButton
                  variant="soft"
                  size="md"
                  icon="plus"
                  label="New Customer"
                  onPress={() => router.push('/customer-add' as any)}
                  style={styles.newCustSpacing}
                />
              </View>
            )}
          </Card>

          {/* Service */}
          <Card>
            <SectionHeader
              title="Service"
              right={
                <Pressable onPress={() => router.push('/service-add' as any)} hitSlop={8}>
                  <Text style={styles.linkSmall}>+ Add</Text>
                </Pressable>
              }
            />
            {services.length === 0 ? (
              <Text style={styles.emptyHint}>No active services yet</Text>
            ) : (
              <View style={styles.serviceGrid}>
                {services.map((s) => {
                  const active = selectedService?.id === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedService(s)}
                      style={({ pressed }) => [
                        styles.serviceChip,
                        active && styles.serviceChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.serviceTop}>
                        <Text style={[styles.serviceName, active && styles.serviceNameActive]} numberOfLines={1}>
                          {s.name}
                        </Text>
                        {active ? (
                          <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.brand} />
                        ) : null}
                      </View>
                      <Text style={[styles.servicePrice, active && styles.servicePriceActive]}>
                        {serviceRateLabel(s)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Weight / Quantity Stepper */}
          {selectedService && selectedService.pricing_type !== 'fixed' ? (
            <Card>
              <SectionHeader
                title={selectedService.pricing_type === 'per_piece' ? 'Pieces' : 'Weight (kg)'}
              />

              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => stepAmount(-1)}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                  accessibilityLabel="Decrease"
                >
                  <MaterialCommunityIcons name="minus" size={20} color={theme.colors.ink} />
                </Pressable>

                <TextInput
                  placeholder={selectedService.pricing_type === 'per_piece' ? '1' : '0.0'}
                  placeholderTextColor={theme.colors.inkMuted}
                  value={selectedService.pricing_type === 'per_piece' ? quantity : weightKg}
                  onChangeText={selectedService.pricing_type === 'per_piece' ? setQuantity : setWeightKg}
                  keyboardType={selectedService.pricing_type === 'per_piece' ? 'number-pad' : 'decimal-pad'}
                  style={styles.stepperInput}
                />

                <Pressable
                  onPress={() => stepAmount(1)}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                  accessibilityLabel="Increase"
                >
                  <MaterialCommunityIcons name="plus" size={20} color={theme.colors.ink} />
                </Pressable>
              </View>

              {selectedService.pricing_type === 'per_load' && loads > 0 ? (
                <View style={styles.loadPill}>
                  <Text style={styles.loadCalcHint}>
                    {loads} {loads === 1 ? 'load' : 'loads'} · {formatPHP(baseCents)}
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Extras & Note */}
          <Card>
            <View style={styles.rushRow}>
              <View style={styles.rushLabelWrap}>
                <MaterialCommunityIcons name="lightning-bolt" size={18} color={theme.colors.rush} />
                <Text style={styles.rushLabel}>Rush</Text>
              </View>
              <Pressable
                onPress={() => setIsRush(!isRush)}
                style={({ pressed }) => [
                  styles.rushPill,
                  isRush && styles.rushPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rushText, isRush && styles.rushTextActive]}>
                  {isRush ? `+${formatPHP(rushCents)}` : 'Off'}
                </Text>
              </Pressable>
            </View>

            {isRush ? (
              <FormField label="Rush fee (₱)">
                <FormInput
                  placeholder="50"
                  value={rushFee}
                  onChangeText={setRushFee}
                  keyboardType="decimal-pad"
                />
              </FormField>
            ) : null}

            <FormField label="Extra fee (₱)">
              <FormInput
                placeholder="0.00"
                value={additionalFee}
                onChangeText={setAdditionalFee}
                keyboardType="decimal-pad"
              />
            </FormField>

            <FormField label="Note">
              <FormInput
                placeholder="Separate whites, extra fabcon..."
                value={notes}
                onChangeText={setNotes}
              />
            </FormField>
          </Card>

          {/* Payment */}
          <Card>
            <SectionHeader
              title="Payment"
              right={
                <View style={styles.quickPayRow}>
                  <Pressable
                    onPress={() => {
                      setPaidFull(false);
                      setAmountPaid('0');
                    }}
                    style={({ pressed }) => [
                      styles.quickPayChip,
                      isUnpaidActive && styles.quickPayChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.quickPayText, isUnpaidActive && styles.quickPayTextActive]}>
                      Unpaid
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setPaidFull(true);
                      setAmountPaid((totalCents / 100).toFixed(2));
                    }}
                    style={({ pressed }) => [
                      styles.quickPayChip,
                      isFullActive && styles.quickPayChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.quickPayText, isFullActive && styles.quickPayTextActive]}>
                      Full
                    </Text>
                  </Pressable>
                </View>
              }
            />

            <FormInput
              placeholder="0.00"
              value={amountPaid}
              onChangeText={(val) => {
                setPaidFull(false);
                setAmountPaid(val);
              }}
              keyboardType="decimal-pad"
            />
            {isOverpaid ? (
              <Text style={styles.error}>Cannot exceed {formatPHP(totalCents)}.</Text>
            ) : null}

            {paidCents > 0 ? (
              <View style={styles.methodWrap}>
                <OptionChips
                  options={paymentMethods}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  layout="equal"
                />

                {paymentMethod !== 'CASH' ? (
                  <FormInput
                    placeholder="Reference #"
                    value={paymentReference}
                    onChangeText={setPaymentReference}
                    containerStyle={styles.refSpacing}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>

          {/* Receipt Summary */}
          <Card>
            <KeyValueRow compact label="Total" value={formatPHP(totalCents)} emphasis="bold" />
            <KeyValueRow compact label="Paid" value={formatPHP(paidCents)} />
            <Divider spacing={8} />
            <KeyValueRow
              compact
              label="Balance"
              value={formatPHP(Math.max(0, balanceCents))}
              emphasis="total"
              valueColor={balanceCents > 0 ? theme.colors.danger : theme.colors.claimed}
            />
          </Card>

          <AppButton
            variant="primary"
            label={saving ? 'Saving...' : 'Create Order'}
            onPress={handleCreate}
            loading={saving}
            disabled={!canCreate || saving}
            style={styles.createSpacing}
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
  linkSmall: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.brandSoft,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.brandBorder,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedName: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  selectedContact: {
    color: theme.colors.brand,
    fontSize: 12,
    marginTop: 1,
    fontWeight: '500',
  },
  changeBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.brandBorder,
  },
  changeBtnText: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: '600',
  },
  customerList: {
    marginTop: theme.spacing.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  customerRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceWarm,
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerName: {
    color: theme.colors.ink,
    fontWeight: '600',
    fontSize: 14,
  },
  customerContact: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  selectLabel: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHint: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    paddingVertical: 10,
  },
  newCustSpacing: {
    marginTop: theme.spacing.xs,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    backgroundColor: theme.colors.surfaceWarm,
    width: '48.5%',
  },
  serviceChipActive: {
    backgroundColor: theme.colors.brandSoft,
    borderColor: theme.colors.brand,
    borderWidth: 1.5,
  },
  serviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  serviceName: {
    color: theme.colors.ink,
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  serviceNameActive: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  servicePrice: {
    color: theme.colors.inkSecondary,
    fontWeight: '600',
    fontSize: 12,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  servicePriceActive: {
    color: theme.colors.brand,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: theme.colors.surfaceWarm,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  loadPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: theme.colors.brandSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  loadCalcHint: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: '600',
  },
  rushRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rushLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rushLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  rushPill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rushPillActive: {
    backgroundColor: theme.colors.rushBg,
  },
  rushText: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  rushTextActive: {
    color: theme.colors.rush,
  },
  quickPayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickPayChip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  quickPayChipActive: {
    backgroundColor: theme.colors.brandSoft,
    borderColor: theme.colors.brandBorder,
  },
  quickPayText: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickPayTextActive: {
    color: theme.colors.brand,
    fontWeight: '700',
  },
  methodWrap: {
    marginTop: 10,
  },
  refSpacing: {
    marginTop: 10,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  createSpacing: {
    marginTop: 4,
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
});
