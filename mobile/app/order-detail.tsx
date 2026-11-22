import { useCallback, useState } from 'react';
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
import { getOrderById, updateOrderStatus } from '@/db/repositories/orders';
import { addPayment, displayMethod, listPaymentsByOrder } from '@/db/repositories/payments';
import { listStatusHistory } from '@/db/repositories/statusHistory';
import { getCustomerById } from '@/db/repositories/customers';
import type { CustomerRow, OrderRow, OrderStatus, PaymentMethod, PaymentRow, StatusHistoryRow } from '@/db/types';
import { formatPHP, formatWeight } from '@/utils/money';
import { formatDate } from '@/utils/dates';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';

const paymentMethods: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'GCASH', label: 'GCash' },
  { key: 'OTHER', label: 'Other' },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthSession();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [history, setHistory] = useState<StatusHistoryRow[]>([]);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      await initDatabase();
      const ord = await getOrderById(id);
      setOrder(ord);
      if (ord) {
        const [cust, pays, hist] = await Promise.all([
          getCustomerById(ord.customer_id),
          listPaymentsByOrder(ord.id),
          listStatusHistory(ord.id),
        ]);
        setCustomer(cust);
        setPayments(pays);
        setHistory(hist);
      }
    } catch (e) {
      console.warn('[OrderDetail] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const advanceStatus = async () => {
    if (!order || !session || busy) return;
    const nextStatus: OrderStatus =
      order.status === 'RECEIVED' ? 'PROCESSING' : order.status === 'PROCESSING' ? 'READY' : 'COMPLETED';

    if (nextStatus === 'COMPLETED' && order.balance_centavos > 0) {
      Alert.alert(
        'Payment Required',
        `This order still has an unpaid balance of ${formatPHP(order.balance_centavos)}.\n\nSettle the remaining balance in Cash now and complete the order?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Settle ${formatPHP(order.balance_centavos)}`,
            onPress: async () => {
              setBusy(true);
              try {
                await addPayment({
                  order_id: order.id,
                  shop_id: session.shop.id,
                  amount_centavos: order.balance_centavos,
                  method: paymentMethod,
                  reference: paymentRef.trim() || null,
                  notes: paymentNotes.trim() || null,
                });
                await updateOrderStatus(order.id, 'COMPLETED', session.user.id);
                setPaymentAmount('');
                setPaymentRef('');
                setPaymentNotes('');
                toast.show('Balance settled & order completed', 'success');
                await load();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Unable to settle and complete order.');
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
      return;
    }

    setBusy(true);
    try {
      await updateOrderStatus(order.id, nextStatus, session.user.id);
      toast.show(`Marked as ${nextStatus}`, 'success');
      await load();
    } catch (e) {
      Alert.alert('Cannot Update Status', e instanceof Error ? e.message : 'Unable to update status.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPayment = async () => {
    if (!order || !session || busy) return;
    const val = parseFloat(paymentAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a payment amount greater than zero.');
      return;
    }
    const cents = Math.round(val * 100);
    setBusy(true);
    try {
      await addPayment({
        order_id: order.id,
        shop_id: session.shop.id,
        amount_centavos: cents,
        method: paymentMethod,
        reference: paymentRef.trim() || null,
        notes: paymentNotes.trim() || null,
      });
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      toast.show(`Recorded ${formatPHP(cents)} payment`, 'success');
      await load();
    } catch (e) {
      Alert.alert('Cannot Record Payment', e instanceof Error ? e.message : 'Payment could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading order..." />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Order Not Found</Text>
          <View style={{ width: 50 }} />
        </View>
        <EmptyState title="Order Not Found" hint="The requested order could not be located." />
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
            <Text style={styles.title}>{order.order_number}</Text>
            <StatusBadge type="sync" value={order.sync_status} />
          </View>

          {/* Status Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.customerName}>{order.customer_name_snapshot ?? customer?.name ?? 'Customer'}</Text>
              <StatusBadge type="order" value={order.status} />
            </View>
            <Text style={styles.serviceName}>
              {order.service_name_snapshot} •{' '}
              {order.pricing_type_snapshot === 'per_piece'
                ? `${order.quantity ?? 0} pc(s)`
                : order.pricing_type_snapshot === 'fixed'
                  ? 'Fixed'
                  : formatWeight(order.weight_grams)}
            </Text>
            <Text style={styles.metaText}>Received {formatDate(order.received_at)}</Text>

            {order.status !== 'COMPLETED' && (
              <Pressable
                onPress={advanceStatus}
                disabled={busy}
                style={[
                  styles.statusActionBtn,
                  order.status === 'READY' && order.balance_centavos > 0 && styles.statusActionBtnPending,
                  busy && styles.btnDisabled,
                ]}
              >
                <Text style={styles.statusActionText}>
                  {order.status === 'RECEIVED'
                    ? 'Mark as Processing / Washing'
                    : order.status === 'PROCESSING'
                      ? 'Mark as Ready for Pickup'
                      : order.balance_centavos > 0
                        ? `Collect ${formatPHP(order.balance_centavos)} to Complete`
                        : 'Mark as Completed / Claimed'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Pricing & Payment Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Pricing & Payment</Text>
              <StatusBadge type="payment" value={order.payment_status} />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Base Cost</Text>
              <Text style={styles.rowValue}>{formatPHP(order.base_cost_centavos)}</Text>
            </View>
            {order.additional_fee_centavos > 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Additional Fee</Text>
                <Text style={styles.rowValue}>{formatPHP(order.additional_fee_centavos)}</Text>
              </View>
            ) : null}
            {order.rush_fee_centavos > 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Rush Fee</Text>
                <Text style={styles.rowValue}>{formatPHP(order.rush_fee_centavos)}</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Total</Text>
              <Text style={styles.rowValue}>{formatPHP(order.total_centavos)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Paid</Text>
              <Text style={styles.rowValue}>{formatPHP(order.amount_paid_centavos)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabelBold}>Balance</Text>
              <Text style={styles.rowBalance}>{formatPHP(order.balance_centavos)}</Text>
            </View>

            {order.balance_centavos > 0 ? (
              <View style={styles.paySection}>
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

                <View style={styles.payBox}>
                  <TextInput
                    placeholder={`Amount (max ${(order.balance_centavos / 100).toFixed(2)})`}
                    placeholderTextColor="#94a3b8"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="decimal-pad"
                    style={styles.payInput}
                  />
                  <Pressable
                    onPress={() => setPaymentAmount((order.balance_centavos / 100).toFixed(2))}
                    style={styles.exactBtn}
                  >
                    <Text style={styles.exactBtnText}>Full</Text>
                  </Pressable>
                </View>

                {paymentMethod !== 'CASH' ? (
                  <TextInput
                    placeholder="Reference number (optional)"
                    placeholderTextColor="#94a3b8"
                    value={paymentRef}
                    onChangeText={setPaymentRef}
                    style={[styles.payInput, { marginTop: 8 }]}
                  />
                ) : null}

                <TextInput
                  placeholder="Payment notes (optional)"
                  placeholderTextColor="#94a3b8"
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  style={[styles.payInput, { marginTop: 8 }]}
                />

                <Pressable onPress={handleAddPayment} disabled={busy} style={[styles.payBtn, busy && styles.btnDisabled]}>
                  <Text style={styles.payBtnText}>{busy ? 'Saving...' : 'Record Payment'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.paidInFullBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#1d4ed8" />
                <Text style={styles.paidInFullText}>Paid in Full</Text>
              </View>
            )}
          </View>

          {/* Payment History */}
          {payments.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment History ({payments.length})</Text>
              {payments.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/payment-detail' as any, params: { id: p.id } })}
                  style={styles.historyRow}
                >
                  <View>
                    <Text style={styles.historyTitle}>
                      {displayMethod(p.method)} {p.reference ? `• Ref: ${p.reference}` : ''}
                    </Text>
                    <Text style={styles.metaText}>{formatDate(p.created_at)}</Text>
                  </View>
                  <Text style={styles.amountHighlight}>+{formatPHP(p.amount_centavos)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Customer Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer Information</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Name</Text>
              <Text style={styles.rowValue}>{order.customer_name_snapshot ?? customer?.name ?? '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Contact</Text>
              <Text style={styles.rowValue}>{customer?.contact_number ?? 'Not available'}</Text>
            </View>
            {order.notes ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Notes</Text>
                <Text style={[styles.rowValue, { flex: 1, textAlign: 'right', marginLeft: 12 }]}>{order.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* Status History */}
          {history.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status Timeline</Text>
              {history.map((h) => (
                <View key={h.id} style={styles.historyRow}>
                  <Text style={styles.historyTitle}>
                    {h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}
                  </Text>
                  <Text style={styles.metaText}>{formatDate(h.changed_at)}</Text>
                </View>
              ))}
            </View>
          ) : null}
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
  title: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { color: '#0f172a', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  customerName: { color: '#0f172a', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  serviceName: { color: '#475569', fontSize: 13, marginTop: 2 },
  metaText: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  statusActionBtn: { backgroundColor: '#1d4ed8', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  statusActionBtnPending: { backgroundColor: '#1e40af', borderWidth: 1, borderColor: '#3b82f6' },
  btnDisabled: { opacity: 0.6 },
  statusActionText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowLabelBold: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  rowBalance: { color: '#1d4ed8', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  paySection: { marginTop: 10 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  methodChip: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  methodChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  methodText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  methodTextActive: { color: '#ffffff' },
  payBox: { flexDirection: 'row', gap: 8 },
  payInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  exactBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  exactBtnText: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' },
  payBtn: { backgroundColor: '#1d4ed8', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  payBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  paidInFullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    justifyContent: 'center',
  },
  paidInFullText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  historyTitle: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  amountHighlight: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
});
