import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getCustomerById, searchCustomers } from '@/db/repositories/customers';
import { listServices } from '@/db/repositories/services';
import { createOrder } from '@/db/repositories/orders';
import type { CustomerRow, PaymentMethod, ServiceRow } from '@/db/types';
import { calcBaseCost, calcBalance, calcLoads, calcTotal, derivePaymentStatus, formatPHP } from '@/utils/money';
import { LoadingState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';

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
  if (s.pricing_type === 'per_piece') return `${rate}/piece`;
  return `${rate} fixed`;
}

export default function ReceiveScreen() {
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const session = useAuthSession();
  const toast = useToast();

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const [custs, srvs] = await Promise.all([
        searchCustomers(customerQuery, session.shop.id),
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
      if (customerId) {
        const found = await getCustomerById(customerId);
        if (found) setSelectedCustomer(found);
      }
    } catch (e) {
      console.warn('[Receive] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session, customerId, customerQuery]);

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
  const balanceCents = useMemo(() => calcBalance(totalCents, paidCents), [totalCents, paidCents]);
  const paymentStatus = useMemo(() => derivePaymentStatus(totalCents, paidCents), [totalCents, paidCents]);

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

  const handleCreate = async () => {
    if (!session || !selectedCustomer || !selectedService) {
      Alert.alert('Missing Details', 'Please select a customer and service.');
      return;
    }
    if (paidCents > totalCents) {
      Alert.alert('Overpayment', 'Initial payment cannot exceed total order amount.');
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

      toast.show(`Order ${created.order_number} created`, 'success');
      Alert.alert('Order Created', `Order ${created.order_number} for ${selectedCustomer.name} has been received.`, [
        { text: 'View Order', onPress: () => router.replace({ pathname: '/order-detail' as any, params: { id: created.id } }) },
        { text: 'Orders List', onPress: () => router.replace('/orders' as any) },
      ]);
    } catch (e) {
      Alert.alert('Cannot Create Order', e instanceof Error ? e.message : 'Unable to create order.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Preparing order form..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.title}>New Laundry Order</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* 1. Customer Selection */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Customer</Text>
            {selectedCustomer ? (
              <View style={styles.selectedBox}>
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>{selectedCustomer.name}</Text>
                  <Text style={styles.selectedContact}>{selectedCustomer.contact_number}</Text>
                  {selectedCustomer.address ? <Text style={styles.selectedAddress}>{selectedCustomer.address}</Text> : null}
                </View>
                <Pressable onPress={() => setSelectedCustomer(null)} style={styles.changeBtn}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <TextInput
                  placeholder="Search customer by name or contact"
                  placeholderTextColor="#94a3b8"
                  value={customerQuery}
                  onChangeText={setCustomerQuery}
                  style={styles.input}
                  autoCapitalize="none"
                />

                <View style={styles.customerList}>
                  {customerResults.length === 0 ? (
                    <Text style={styles.emptyHint}>No customers found. Add one below.</Text>
                  ) : (
                    customerResults.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedCustomer(c)}
                        style={({ pressed }) => [styles.customerRow, pressed && styles.rowPressed]}
                      >
                        <View style={styles.customerRowLeft}>
                          <View style={styles.customerAvatar}>
                            <Ionicons name="person-outline" size={16} color="#1d4ed8" />
                          </View>
                          <View>
                            <Text style={styles.customerName}>{c.name}</Text>
                            <Text style={styles.customerContact}>{c.contact_number}</Text>
                          </View>
                        </View>
                        <View style={styles.selectBadge}>
                          <Text style={styles.selectBadgeText}>Select</Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>

                <Pressable onPress={() => router.push('/customer-add' as any)} style={styles.addNewCustBtn}>
                  <Ionicons name="add" size={16} color="#1d4ed8" />
                  <Text style={styles.addNewCustText}>Add New Customer</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* 2. Service */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>2. Service</Text>
              <Pressable onPress={() => router.push('/service-add' as any)}>
                <Text style={styles.linkSmall}>+ Add Service</Text>
              </Pressable>
            </View>
            {services.length === 0 ? (
              <Text style={styles.emptyHint}>No active services yet. Tap "+ Add Service" above.</Text>
            ) : (
              <View style={styles.serviceGrid}>
                {services.map((s) => {
                  const active = selectedService?.id === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedService(s)}
                      style={[styles.serviceChip, active && styles.serviceChipActive]}
                    >
                      <Text style={[styles.serviceName, active && styles.serviceNameActive]}>{s.name}</Text>
                      <Text style={[styles.servicePrice, active && styles.servicePriceActive]}>{serviceRateLabel(s)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 3. Weight / Quantity (hidden for FIXED services) */}
          {selectedService && selectedService.pricing_type !== 'fixed' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {selectedService.pricing_type === 'per_piece' ? '3. Quantity (pieces)' : '3. Weight (kg)'}
              </Text>
              {selectedService.pricing_type === 'per_piece' ? (
                <TextInput
                  placeholder="1"
                  placeholderTextColor="#94a3b8"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              ) : (
                <>
                  <TextInput
                    placeholder="0.0"
                    placeholderTextColor="#94a3b8"
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                  {selectedService.pricing_type === 'per_load' && loads > 0 ? (
                    <Text style={styles.loadCalcHint}>
                      {loads} {loads === 1 ? 'Load' : 'Loads'} ({weightBlockGrams / 1000}kg/load) • Base {formatPHP(baseCents)}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* 4. Fees, Rush & Initial Payment */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Details, Fees & Payment</Text>

            <View style={styles.rushRow}>
              <Text style={styles.label}>Rush Order</Text>
              <Pressable onPress={() => setIsRush(!isRush)} style={[styles.rushPill, isRush && styles.rushPillActive]}>
                <Text style={[styles.rushText, isRush && styles.rushTextActive]}>
                  {isRush ? `Yes (+${formatPHP(rushCents)})` : 'No'}
                </Text>
              </Pressable>
            </View>

            {isRush ? (
              <>
                <Text style={styles.label}>Rush Fee (₱)</Text>
                <TextInput
                  placeholder="50"
                  placeholderTextColor="#94a3b8"
                  value={rushFee}
                  onChangeText={setRushFee}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </>
            ) : null}

            <Text style={styles.label}>Additional Fee (₱, Optional)</Text>
            <TextInput
              placeholder="0.00 (e.g. extra fabcon, stain removal)"
              placeholderTextColor="#94a3b8"
              value={additionalFee}
              onChangeText={setAdditionalFee}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <View style={styles.payHeaderRow}>
              <Text style={styles.label}>Initial Payment (₱)</Text>
              <View style={styles.quickPayRow}>
                <Pressable onPress={() => setAmountPaid((totalCents / 100).toFixed(2))} style={styles.quickPayChip}>
                  <Text style={styles.quickPayText}>Full ({formatPHP(totalCents)})</Text>
                </Pressable>
                <Pressable onPress={() => setAmountPaid('0')} style={styles.quickPayChip}>
                  <Text style={styles.quickPayText}>₱0 (Unpaid)</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              value={amountPaid}
              onChangeText={setAmountPaid}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            {isOverpaid ? <Text style={styles.error}>Initial payment cannot exceed {formatPHP(totalCents)}.</Text> : null}

            {paidCents > 0 ? (
              <>
                <Text style={styles.label}>Payment Method</Text>
                <View style={styles.methodRow}>
                  {paymentMethods.map((m) => {
                    const active = paymentMethod === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => setPaymentMethod(m.key)}
                        style={[styles.methodChip, active && styles.methodChipActive]}
                      >
                        <Text style={[styles.methodText, active && styles.methodTextActive]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {paymentMethod !== 'CASH' ? (
                  <>
                    <Text style={styles.label}>Reference Number (Optional)</Text>
                    <TextInput
                      placeholder="GCash / Transaction Ref"
                      placeholderTextColor="#94a3b8"
                      value={paymentReference}
                      onChangeText={setPaymentReference}
                      style={styles.input}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>Special Notes</Text>
            <TextInput
              placeholder="Optional instructions..."
              placeholderTextColor="#94a3b8"
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, { minHeight: 44 }]}
            />
          </View>

          {/* 5. Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer</Text>
              <Text style={styles.summaryValue}>{selectedCustomer ? selectedCustomer.name : 'None selected'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base Cost</Text>
              <Text style={styles.summaryValue}>{formatPHP(baseCents)}</Text>
            </View>
            {additionalCents > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Additional Fee</Text>
                <Text style={styles.summaryValue}>{formatPHP(additionalCents)}</Text>
              </View>
            ) : null}
            {rushCents > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rush Fee</Text>
                <Text style={styles.summaryValue}>{formatPHP(rushCents)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryTotal}>{formatPHP(totalCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid ({paymentStatus})</Text>
              <Text style={styles.summaryValue}>{formatPHP(paidCents)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Balance</Text>
              <Text style={styles.summaryBalance}>{formatPHP(Math.max(0, balanceCents))}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={!canCreate || saving}
            style={[styles.createButton, (!canCreate || saving) && styles.buttonDisabled]}
          >
            <Text style={styles.createText}>{saving ? 'Creating Order...' : 'Confirm & Create Order'}</Text>
          </Pressable>
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#0f172a', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  linkSmall: { color: '#1d4ed8', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  label: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 8 },
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
  emptyHint: { color: '#94a3b8', fontSize: 12, paddingVertical: 8 },
  loadCalcHint: { color: '#1d4ed8', fontSize: 12, fontWeight: '600', marginTop: 6 },
  selectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  selectedInfo: { flex: 1 },
  selectedName: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  selectedContact: { color: '#1d4ed8', fontSize: 12, marginTop: 2 },
  selectedAddress: { color: '#64748b', fontSize: 11, marginTop: 2 },
  changeBtn: { backgroundColor: '#ffffff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#bfdbfe' },
  changeBtnText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  customerList: { marginTop: 10 },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowPressed: { backgroundColor: '#f1f5f9' },
  customerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerAvatar: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  customerName: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  customerContact: { color: '#64748b', fontSize: 11, marginTop: 1 },
  selectBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#bfdbfe' },
  selectBadgeText: { color: '#1d4ed8', fontSize: 11, fontWeight: '600' },
  addNewCustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addNewCustText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#ffffff', width: '48%' },
  serviceChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  serviceName: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  serviceNameActive: { color: '#ffffff' },
  servicePrice: { color: '#1d4ed8', fontWeight: '700', fontSize: 12, marginTop: 2 },
  servicePriceActive: { color: '#bfdbfe' },
  rushRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rushPill: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  rushPillActive: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  rushText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  rushTextActive: { color: '#1d4ed8' },
  payHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 },
  quickPayRow: { flexDirection: 'row', gap: 6 },
  quickPayChip: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#bfdbfe' },
  quickPayText: { color: '#1d4ed8', fontSize: 11, fontWeight: '600' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: '#ffffff' },
  methodChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  methodText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  methodTextActive: { color: '#ffffff' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { color: '#64748b', fontSize: 13 },
  summaryLabelBold: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  summaryValue: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  summaryTotal: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  summaryBalance: { color: '#1d4ed8', fontSize: 16, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  error: { color: '#b91c1c', fontSize: 12, marginTop: 6 },
  createButton: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.5 },
  createText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
