import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { searchCustomers } from '@/db/repositories/customers';
import { listServices } from '@/db/repositories/services';
import { createOrder } from '@/db/repositories/orders';
import type { CustomerRow, ServiceRow } from '@/db/types';
import { calcBaseCost, calcBalance, calcLoads, calcTotal, derivePaymentStatus, formatPHP } from '@/utils/money';

export default function ReceiveScreen() {
  const { state } = useAuth();
  const shopId = state.status === 'authenticated' ? state.session.shop.id : null;

  // Customer
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Services
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);

  // Inputs
  const [weightKg, setWeightKg] = useState(''); // for per_kg: e.g., 5.5
  const [quantity, setQuantity] = useState(''); // for per_piece
  const [additionalFee, setAdditionalFee] = useState('');
  const [rushFee, setRushFee] = useState('');
  const [isRush, setIsRush] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load services (active only)
  useEffect(() => {
    if (!shopId) return;
    (async () => {
      setLoadingServices(true);
      try {
        const rows = await listServices(shopId, false);
        setServices(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingServices(false);
      }
    })();
  }, [shopId]);

  // Search customers when query changes
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoadingCustomers(true);
      try {
        const rows = await searchCustomers(customerQuery, shopId);
        if (!cancelled) setCustomerResults(rows);
      } catch {
        if (!cancelled) setCustomerResults([]);
      } finally {
        if (!cancelled) setLoadingCustomers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerQuery, shopId]);

  // Price calculations
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
      weightBlockGrams: weightBlockGrams,
    });
  }, [selectedService, parsedWeightGrams, parsedQuantity, weightBlockGrams]);
  const totalCents = useMemo(() => calcTotal(baseCents, additionalCents, rushCents), [baseCents, additionalCents, rushCents]);
  const balanceCents = useMemo(() => calcBalance(totalCents, paidCents), [totalCents, paidCents]);
  const paymentStatus = useMemo(() => derivePaymentStatus(totalCents, paidCents), [totalCents, paidCents]);

  const canCreate = useMemo(() => {
    if (!selectedCustomer) return false;
    if (!selectedService) return false;
    if (selectedService.pricing_type === 'per_kg' && !parsedWeightGrams) return false;
    if (selectedService.pricing_type === 'per_load' && !parsedWeightGrams) return false;
    if (selectedService.pricing_type === 'per_piece' && !parsedQuantity) return false;
    if (totalCents <= 0) return false;
    if (paidCents < 0 || paidCents > totalCents) return false;
    return true;
  }, [selectedCustomer, selectedService, parsedWeightGrams, parsedQuantity, totalCents, paidCents]);

  const handleCreate = async () => {
    setError(null);
    if (!shopId) {
      setError('Shop not found. Please re-login.');
      return;
    }
    if (!selectedCustomer || !selectedService) {
      setError('Select customer and service.');
      return;
    }
    // Show review alert first
    const isLoad = selectedService.pricing_type === 'per_load';
    const blockKg = (selectedService.weight_block_grams ?? 8000) / 1000;
    const summary = `Customer: ${selectedCustomer.name}\nService: ${selectedService.name}\nRate: ${formatPHP(selectedService.unit_price_centavos)}${isLoad ? ` / ${blockKg}kg` : selectedService.pricing_type === 'per_kg' ? '/kg' : selectedService.pricing_type === 'per_piece' ? '/piece' : ''}\n${isLoad ? `Weight: ${(parsedWeightGrams ?? 0) / 1000}kg\nLoads: ${loads}\n` : ''}Base: ${formatPHP(baseCents)}\nAdditional: ${formatPHP(additionalCents)}\nRush: ${formatPHP(rushCents)}\nTOTAL: ${formatPHP(totalCents)}\nPaid: ${formatPHP(paidCents)}\nBALANCE: ${formatPHP(balanceCents)}`;
    Alert.alert('Review Order', summary, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Create Order',
        onPress: async () => {
          setSaving(true);
          try {
            const order = await createOrder({
              shop_id: shopId,
              customer_id: selectedCustomer.id,
              customer_name_snapshot: selectedCustomer.name,
              service_id: selectedService.id,
              service_name: selectedService.name,
              pricing_type: selectedService.pricing_type,
              unit_price_centavos: selectedService.unit_price_centavos,
              weight_block_grams: selectedService.pricing_type === 'per_load' ? (selectedService.weight_block_grams ?? 8000) : null,
              weight_grams: parsedWeightGrams,
              quantity: parsedQuantity,
              additional_fee_centavos: additionalCents,
              rush_fee_centavos: rushCents,
              is_rush: isRush,
              amount_paid_centavos: paidCents,
              notes: notes.trim() || null,
            });
            Alert.alert('Order successfully received', `Order Number:\n${order.order_number}`, [
              {
                text: 'View Order',
                onPress: () => router.replace({ pathname: '/order-detail' as any, params: { id: order.id } }),
              },
              { text: 'New Order', onPress: () => router.replace('/receive' as any) },
            ]);
            // Reset form for next order (if user stays)
            setWeightKg('');
            setQuantity('');
            setAdditionalFee('');
            setRushFee('');
            setAmountPaid('');
            setNotes('');
            setIsRush(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Receive Laundry</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Customer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Customer</Text>
          {selectedCustomer ? (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedName}>{selectedCustomer.name}</Text>
              <Text style={styles.selectedContact}>{selectedCustomer.contact_number}</Text>
              <Pressable onPress={() => setSelectedCustomer(null)} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                placeholder="Search name or contact"
                value={customerQuery}
                onChangeText={setCustomerQuery}
                style={styles.input}
                autoCapitalize="none"
              />
              {loadingCustomers ? (
                <ActivityIndicator size="small" color="#3157d5" style={{ marginTop: 8 }} />
              ) : (
                <View style={{ marginTop: 8 }}>
                  {customerResults.length === 0 ? (
                    <Text style={styles.hint}>No customers found. Try search or add new.</Text>
                  ) : (
                    customerResults.slice(0, 5).map((c) => (
                      <Pressable key={c.id} onPress={() => setSelectedCustomer(c)} style={styles.resultRow}>
                        <Text style={styles.resultName}>{c.name}</Text>
                        <Text style={styles.resultContact}>{c.contact_number}</Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable onPress={() => router.push('/customer-add' as any)} style={styles.linkButton}>
                    <Text style={styles.linkText}>＋ Add New Customer</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {/* Service */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Service</Text>
          {loadingServices ? (
            <ActivityIndicator color="#3157d5" />
          ) : services.length === 0 ? (
            <Text style={styles.hint}>No active services. Create one in Services & Rates.</Text>
          ) : (
            <View style={styles.serviceGrid}>
              {services.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedService(s)}
                  style={[styles.serviceChip, selectedService?.id === s.id && styles.serviceChipActive]}
                >
                  <Text style={[styles.serviceName, selectedService?.id === s.id && styles.serviceNameActive]}>{s.name}</Text>
                  <Text style={[styles.servicePrice, selectedService?.id === s.id && styles.servicePriceActive]}>
                    {s.pricing_type === 'per_load'
                      ? `${formatPHP(s.unit_price_centavos)} / ${s.weight_block_grams ? s.weight_block_grams / 1000 : 8}kg`
                      : `${formatPHP(s.unit_price_centavos)}${s.pricing_type === 'per_kg' ? '/kg' : s.pricing_type === 'per_piece' ? '/piece' : ''}`}
                  </Text>
                  <Text style={[styles.serviceType, selectedService?.id === s.id && styles.serviceTypeActive]}>
                    {s.pricing_type === 'per_kg'
                      ? 'Per kilogram'
                      : s.pricing_type === 'per_piece'
                        ? 'Per piece'
                        : s.pricing_type === 'per_load'
                          ? `Per load (${s.weight_block_grams ? s.weight_block_grams / 1000 : 8}kg)`
                          : 'Fixed price'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {selectedService ? (
            <Text style={styles.selectedServiceHint}>
              Selected: {selectedService.name} •{' '}
              {selectedService.pricing_type === 'per_load'
                ? `${formatPHP(selectedService.unit_price_centavos)} per ${selectedService.weight_block_grams ? selectedService.weight_block_grams / 1000 : 8}kg`
                : formatPHP(selectedService.unit_price_centavos)}
            </Text>
          ) : null}
        </View>

        {/* Weight / Quantity */}
        {selectedService?.pricing_type === 'per_kg' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Weight</Text>
            <Text style={styles.label}>Weight (kg) *</Text>
            <TextInput placeholder="5.5" value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" style={styles.input} />
            <Text style={styles.hint}>Stored as grams: {parsedWeightGrams ?? 0}g</Text>
          </View>
        )}
        {selectedService?.pricing_type === 'per_load' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Weight (Package)</Text>
            <Text style={styles.label}>Weight (kg) *</Text>
            <TextInput placeholder="5.5" value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" style={styles.input} />
            <Text style={styles.hint}>
              Rate: {formatPHP(selectedService.unit_price_centavos)} per {(selectedService.weight_block_grams ?? 8000) / 1000}kg • Loads: {loads} • Laundry Charge: {formatPHP(baseCents)}
            </Text>
            <Text style={styles.hint}>Stored as grams: {parsedWeightGrams ?? 0}g • Block: {(weightBlockGrams ?? 8000) / 1000}kg</Text>
          </View>
        )}
        {selectedService?.pricing_type === 'per_piece' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Quantity</Text>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput placeholder="2" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={styles.input} />
          </View>
        )}
        {selectedService?.pricing_type === 'fixed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Fixed Price</Text>
            <Text style={styles.hint}>No weight/quantity needed. Base = {formatPHP(selectedService.unit_price_centavos)}</Text>
          </View>
        )}

        {/* Fees */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>4. Additional Charges</Text>
          <Text style={styles.label}>Additional Fee (₱)</Text>
          <TextInput placeholder="0" value={additionalFee} onChangeText={setAdditionalFee} keyboardType="decimal-pad" style={styles.input} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <Pressable onPress={() => setIsRush(!isRush)} style={[styles.toggle, isRush ? styles.toggleActive : styles.toggleInactive]}>
              <Text style={styles.toggleText}>{isRush ? 'Rush: ON' : 'Rush: OFF'}</Text>
            </Pressable>
            <TextInput
              placeholder="0"
              value={rushFee}
              onChangeText={setRushFee}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1, marginLeft: 10, marginTop: 0 }]}
              editable={isRush}
            />
          </View>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput placeholder="Separate whites, no fabric conditioner..." value={notes} onChangeText={setNotes} style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} multiline />

          <Text style={styles.label}>Initial Payment (₱)</Text>
          <TextInput placeholder="0" value={amountPaid} onChangeText={setAmountPaid} keyboardType="decimal-pad" style={styles.input} />
        </View>

        {/* Price Review */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>5. Review</Text>
          {selectedService ? (
            <>
              <Row
                label="Rate"
                value={
                  selectedService.pricing_type === 'per_load'
                    ? `${formatPHP(selectedService.unit_price_centavos)} per ${(selectedService.weight_block_grams ?? 8000) / 1000}kg`
                    : selectedService.pricing_type === 'per_kg'
                      ? `${formatPHP(selectedService.unit_price_centavos)}/kg`
                      : selectedService.pricing_type === 'per_piece'
                        ? `${formatPHP(selectedService.unit_price_centavos)}/piece`
                        : formatPHP(selectedService.unit_price_centavos)
                }
              />
              {selectedService.pricing_type === 'per_load' && parsedWeightGrams ? (
                <>
                  <Row label="Weight" value={`${(parsedWeightGrams / 1000).toFixed(2)} kg`} />
                  <Row label="Loads" value={`${loads}`} />
                </>
              ) : null}
              {selectedService.pricing_type === 'per_kg' && parsedWeightGrams ? <Row label="Weight" value={`${(parsedWeightGrams / 1000).toFixed(2)} kg`} /> : null}
              {selectedService.pricing_type === 'per_piece' && parsedQuantity ? <Row label="Quantity" value={`${parsedQuantity}`} /> : null}
            </>
          ) : null}
          <Row label="Base" value={formatPHP(baseCents)} />
          <Row label="Additional" value={formatPHP(additionalCents)} />
          <Row label="Rush" value={formatPHP(rushCents)} />
          <View style={styles.divider} />
          <Row label="TOTAL" value={formatPHP(totalCents)} bold />
          <Row label="Paid" value={formatPHP(paidCents)} />
          <Row label="BALANCE" value={formatPHP(balanceCents)} bold />
          <Row label="Payment Status" value={paymentStatus} />
          <Text style={styles.hint}>
            Snapshot:{' '}
            {selectedService
              ? selectedService.pricing_type === 'per_load'
                ? `${selectedService.name} ${formatPHP(selectedService.unit_price_centavos)} / ${selectedService.weight_block_grams ? selectedService.weight_block_grams / 1000 : 8}kg`
                : `${selectedService.name} ${formatPHP(selectedService.unit_price_centavos)}/${selectedService.pricing_type}`
              : '-'}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={handleCreate} disabled={!canCreate || saving} style={[styles.createButton, (!canCreate || saving) && styles.buttonDisabled]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>Create Order</Text>}
        </Pressable>
        <Text style={styles.offlineHint}>Saved locally (PENDING). Works offline.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '800' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '800', color: '#172554' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  title: { color: '#172554', fontSize: 18, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 12, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  cardTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  label: { color: '#334155', fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a' },
  hint: { color: '#64748b', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  selectedBox: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12 },
  selectedName: { color: '#0f172a', fontWeight: '700' },
  selectedContact: { color: '#3157d5', fontSize: 12, marginTop: 2 },
  smallButton: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  smallButtonText: { color: '#1e293b', fontSize: 12, fontWeight: '600' },
  resultRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  resultName: { color: '#0f172a', fontWeight: '600' },
  resultContact: { color: '#64748b', fontSize: 12 },
  linkButton: { marginTop: 8, alignSelf: 'flex-start' },
  linkText: { color: '#3157d5', fontWeight: '700', fontSize: 13 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 10, backgroundColor: '#fff', minWidth: '48%' },
  serviceChipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  serviceName: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  serviceNameActive: { color: '#fff' },
  servicePrice: { color: '#3157d5', fontWeight: '700', fontSize: 12, marginTop: 2 },
  servicePriceActive: { color: '#a5b4fc' },
  serviceType: { color: '#64748b', fontSize: 10, marginTop: 2 },
  serviceTypeActive: { color: '#cbd5e1' },
  selectedServiceHint: { color: '#64748b', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  toggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  toggleActive: { backgroundColor: '#dcfce7' },
  toggleInactive: { backgroundColor: '#fee2e2' },
  toggleText: { fontWeight: '700', fontSize: 12, color: '#1e293b' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12, textAlign: 'center' },
  createButton: { backgroundColor: '#3157d5', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.5 },
  createText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  offlineHint: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
