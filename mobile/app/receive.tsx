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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import type { CustomerRow, ServiceRow } from '@/db/types';
import { calcBaseCost, calcBalance, calcLoads, calcTotal, derivePaymentStatus, formatPHP } from '@/utils/money';
import { customerStore, CustomerItem } from '@/store/customerStore';
import { orderStore } from '@/store/orderStore';
import { serviceStore, LocalService } from '@/store/serviceStore';

export default function ReceiveScreen() {
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();

  // No customer is picked automatically
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(() => {
    if (customerId) {
      return customerStore.getById(customerId) ?? null;
    }
    return null;
  });

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerItem[]>(customerStore.getAll());

  useEffect(() => {
    const unsub = customerStore.subscribe(() => {
      setCustomerResults(customerStore.search(customerQuery));
    });
    return unsub;
  }, [customerQuery]);

  useEffect(() => {
    setCustomerResults(customerStore.search(customerQuery));
  }, [customerQuery]);

  useEffect(() => {
    if (customerId) {
      const found = customerStore.getById(customerId);
      if (found) setSelectedCustomer(found);
    }
  }, [customerId]);

  const [services, setServices] = useState<LocalService[]>(serviceStore.getActive());
  const [selectedService, setSelectedService] = useState<LocalService | null>(services[0] ?? null);

  useEffect(() => {
    const unsub = serviceStore.subscribe(() => {
      const active = serviceStore.getActive();
      setServices(active);
      setSelectedService((curr) => {
        if (!curr) return active[0] ?? null;
        return active.find((s) => s.id === curr.id) ?? active[0] ?? null;
      });
    });
    return unsub;
  }, []);

  const calcDefaultPayment = (
    service: LocalService | null,
    weightStr: string,
    qtyStr: string
  ): string => {
    if (!service) return '0';
    if (service.pricing_type === 'per_load' || service.pricing_type === 'fixed') {
      return (service.unit_price_centavos / 100).toString();
    }
    if (service.pricing_type === 'per_kg') {
      const kg = parseFloat(weightStr);
      const effectiveKg = isNaN(kg) || kg <= 0 ? 5 : kg;
      return Math.round(effectiveKg * (service.unit_price_centavos / 100)).toString();
    }
    if (service.pricing_type === 'per_piece') {
      const q = parseInt(qtyStr, 10);
      const effectiveQty = isNaN(q) || q <= 0 ? 1 : q;
      return Math.round(effectiveQty * (service.unit_price_centavos / 100)).toString();
    }
    return (service.unit_price_centavos / 100).toString();
  };

  const [weightKg, setWeightKg] = useState('6.0');
  const [quantity, setQuantity] = useState('1');
  const [additionalFee, setAdditionalFee] = useState('');
  const [rushFee, setRushFee] = useState('50');
  const [isRush, setIsRush] = useState(false);
  const [amountPaid, setAmountPaid] = useState(() =>
    calcDefaultPayment(services[0] ?? null, '6.0', '1')
  );
  const [notes, setNotes] = useState('');

  const handleSelectService = (s: LocalService) => {
    setSelectedService(s);
    setAmountPaid(calcDefaultPayment(s, weightKg, quantity));
  };

  const handleWeightChange = (val: string) => {
    setWeightKg(val);
    if (selectedService && selectedService.pricing_type === 'per_kg') {
      setAmountPaid(calcDefaultPayment(selectedService, val, quantity));
    }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    if (selectedService && selectedService.pricing_type === 'per_piece') {
      setAmountPaid(calcDefaultPayment(selectedService, weightKg, val));
    }
  };

  const [saving] = useState(false);
  const [error] = useState<string | null>(null);

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

  const handleCreate = () => {
    if (!selectedCustomer || !selectedService) {
      Alert.alert('Customer Required', 'Please select a customer and service.');
      return;
    }
    const created = orderStore.createOrder({
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      customer_contact: selectedCustomer.contact_number || '',
      service_id: selectedService.id,
      service_name: selectedService.name,
      pricing_type: selectedService.pricing_type,
      quantity_or_weight: selectedService.pricing_type === 'per_piece' ? (parsedQuantity ?? 1) : ((parsedWeightGrams ?? 0) / 1000),
      total_centavos: totalCents,
      paid_centavos: paidCents,
      notes: notes.trim() || undefined,
    });

    Alert.alert('Order Created', `Order ${created.order_number} for ${selectedCustomer.name} has been received.`, [
      { text: 'View Order', onPress: () => router.replace({ pathname: '/order-detail' as any, params: { id: created.id } }) },
      { text: 'Orders List', onPress: () => router.replace('/orders' as any) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <Text style={styles.cardTitle}>Customer</Text>
          {selectedCustomer ? (
            <View style={styles.selectedBox}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName}>{selectedCustomer.name}</Text>
                {selectedCustomer.contact_number ? (
                  <Text style={styles.selectedContact}>{selectedCustomer.contact_number}</Text>
                ) : null}
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
                {customerResults.map((c) => (
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
                        {c.contact_number ? <Text style={styles.customerContact}>{c.contact_number}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.selectBadge}>
                      <Text style={styles.selectBadgeText}>Select</Text>
                    </View>
                  </Pressable>
                ))}
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
          <Text style={styles.cardTitle}>Service</Text>
          <View style={styles.serviceGrid}>
            {services.map((s) => {
              const active = selectedService?.id === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => handleSelectService(s)}
                  style={[styles.serviceChip, active && styles.serviceChipActive]}
                >
                  <Text style={[styles.serviceName, active && styles.serviceNameActive]}>{s.name}</Text>
                  <Text style={[styles.servicePrice, active && styles.servicePriceActive]}>
                    {s.pricing_type === 'per_load'
                      ? `${formatPHP(s.unit_price_centavos)} / load`
                      : `${formatPHP(s.unit_price_centavos)}${s.pricing_type === 'per_kg' ? '/kg' : '/piece'}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. Weight / Quantity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {selectedService?.pricing_type === 'per_piece' ? 'Quantity' : 'Weight (kg)'}
          </Text>
          {selectedService?.pricing_type === 'per_piece' ? (
            <TextInput
              placeholder="1"
              placeholderTextColor="#94a3b8"
              value={quantity}
              onChangeText={handleQuantityChange}
              keyboardType="number-pad"
              style={styles.input}
            />
          ) : (
            <TextInput
              placeholder="0.0"
              placeholderTextColor="#94a3b8"
              value={weightKg}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          )}
        </View>

        {/* 4. Options & Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details & Payment</Text>
          
          <View style={styles.rushRow}>
            <Text style={styles.label}>Rush Order</Text>
            <Pressable
              onPress={() => setIsRush(!isRush)}
              style={[styles.rushPill, isRush && styles.rushPillActive]}
            >
              <Text style={[styles.rushText, isRush && styles.rushTextActive]}>
                {isRush ? 'Yes (+₱50)' : 'No'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.payHeaderRow}>
            <Text style={styles.label}>Initial Payment (₱)</Text>
            <View style={styles.quickPayRow}>
              <Pressable
                onPress={() => setAmountPaid((totalCents / 100).toFixed(0))}
                style={styles.quickPayChip}
              >
                <Text style={styles.quickPayText}>Full (₱{(totalCents / 100).toFixed(0)})</Text>
              </Pressable>
              <Pressable
                onPress={() => setAmountPaid('0')}
                style={styles.quickPayChip}
              >
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
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryTotal}>{formatPHP(totalCents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>{formatPHP(paidCents)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Balance</Text>
            <Text style={styles.summaryBalance}>{formatPHP(balanceCents)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleCreate}
          disabled={!canCreate || saving}
          style={[styles.createButton, (!canCreate || saving) && styles.buttonDisabled]}
        >
          <Text style={styles.createText}>Confirm & Create Order</Text>
        </Pressable>
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { color: '#0f172a', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  label: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a' },
  selectedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#dbeafe' },
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
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  customerContact: { color: '#64748b', fontSize: 11, marginTop: 1 },
  selectBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
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
  payHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  quickPayRow: { flexDirection: 'row', gap: 6 },
  quickPayChip: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  quickPayText: { color: '#1d4ed8', fontSize: 11, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { color: '#64748b', fontSize: 13 },
  summaryLabelBold: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  summaryValue: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  summaryTotal: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  summaryBalance: { color: '#1d4ed8', fontSize: 16, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  error: { color: '#b91c1c', fontSize: 12, marginTop: 8, textAlign: 'center' },
  createButton: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.5 },
  createText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
