import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getOrderById, updateOrderStatus, deleteOrder } from '@/db/repositories/orders';
import { getCustomerById } from '@/db/repositories/customers';
import { addPayment, listPaymentsByOrder } from '@/db/repositories/payments';
import { listStatusHistory } from '@/db/repositories/statusHistory';
import type { OrderRow, PaymentRow, StatusHistoryRow } from '@/db/types';
import { formatPHP, calcLoads } from '@/utils/money';
import { readyAgingLabel, isLongWaiting } from '@/utils/dates';
import { displayMethod } from '@/db/repositories/payments';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [customerContact, setCustomerContact] = useState<string>('');
  const [history, setHistory] = useState<StatusHistoryRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'OTHER'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getOrderById(id as string);
      if (!row) {
        setError('Order not found');
        return;
      }
      setOrder(row);
      const cust = await getCustomerById(row.customer_id).catch(() => null);
      setCustomerContact(cust?.contact_number ?? '');
      const h = await listStatusHistory(row.id).catch(() => []);
      setHistory(h);
      const p = await listPaymentsByOrder(row.id).catch(() => []);
      setPayments(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatus = async (next: 'PROCESSING' | 'READY' | 'COMPLETED') => {
    if (!order) return;
    const confirmMsg =
      next === 'PROCESSING'
        ? 'Start processing this laundry?'
        : next === 'READY'
          ? 'Mark this laundry as ready for pickup?'
          : 'Mark this order as completed?';
    if (next === 'COMPLETED' && order.balance_centavos > 0) {
      Alert.alert('Unpaid Balance', `This order still has a ${formatPHP(order.balance_centavos)} balance. Please settle the remaining balance before completing the order.`);
      return;
    }
    Alert.alert('Confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setActionLoading(true);
          try {
            const updated = await updateOrderStatus(order.id, next as any);
            setOrder(updated);
            const h = await listStatusHistory(updated.id);
            setHistory(h);
          } catch (e) {
            Alert.alert('Failed', e instanceof Error ? e.message : String(e));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleAddPayment = async () => {
    if (!order) return;
    setPaymentError(null);
    if (order.balance_centavos <= 0) {
      setPaymentError('This order is already fully paid.');
      return;
    }
    const v = parseFloat(paymentInput);
    if (isNaN(v) || v <= 0) {
      setPaymentError('Enter amount > 0');
      return;
    }
    const cents = Math.round(v * 100);
    if (cents > order.balance_centavos) {
      setPaymentError(`Amount exceeds balance ${formatPHP(order.balance_centavos)}`);
      return;
    }
    setPaymentLoading(true);
    try {
      await addPayment({ order_id: order.id, shop_id: order.shop_id, amount_centavos: cents, method: paymentMethod, reference: paymentReference, notes: paymentNotes });
      setPaymentInput('');
      setPaymentReference('');
      setPaymentNotes('');
      // reload order and payments
      const updated = await getOrderById(order.id);
      if (updated) setOrder(updated);
      const p = await listPaymentsByOrder(order.id);
      setPayments(p);
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : String(e));
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    Alert.alert('Delete Order', 'Archive this order? It will disappear from active lists but payments and history remain and can be restored. Works offline and will sync.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOrder(order.id);
            router.back();
          } catch (e) {
            Alert.alert('Failed', e instanceof Error ? e.message : String(e));
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
          <Text style={styles.hint}>Loading order...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (error || !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Not found'}</Text>
          <Pressable onPress={() => router.back()} style={styles.button}>
            <Text style={styles.buttonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const aging = order.status === 'READY' ? readyAgingLabel(order.ready_at) : '';
  const longWait = order.status === 'READY' && isLongWaiting(order.ready_at);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Order Details</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <View style={[styles.badge, order.status === 'RECEIVED' ? styles.badgeReceived : order.status === 'PROCESSING' ? styles.badgeProcessing : order.status === 'READY' ? styles.badgeReady : styles.badgeCompleted]}>
            <Text style={styles.badgeText}>{order.status}</Text>
          </View>
          <Text style={styles.subtitle}>Received {new Date(order.received_at).toLocaleString()}</Text>
          {aging ? <Text style={[styles.aging, longWait && styles.agingLong]}>{aging} {longWait ? '• Waiting for pickup' : ''}</Text> : null}
          {order.ready_at ? <Text style={styles.hint}>Ready at {new Date(order.ready_at).toLocaleString()}</Text> : null}
        </View>

        {/* Status Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.statusBig}>{order.status}</Text>
          {order.status === 'RECEIVED' && (
            <Pressable onPress={() => void handleStatus('PROCESSING')} disabled={actionLoading} style={[styles.actionButton, styles.actionProcessing]}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Start Processing</Text>}
            </Pressable>
          )}
          {order.status === 'PROCESSING' && (
            <Pressable onPress={() => void handleStatus('READY')} disabled={actionLoading} style={[styles.actionButton, styles.actionReady]}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Mark as Ready</Text>}
            </Pressable>
          )}
          {order.status === 'READY' && (
            <Pressable onPress={() => void handleStatus('COMPLETED')} disabled={actionLoading} style={[styles.actionButton, styles.actionCompleted]}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Mark as Completed</Text>}
            </Pressable>
          )}
          {order.status === 'COMPLETED' && <Text style={styles.hint}>No further action — order completed.</Text>}
          {order.status === 'READY' && order.balance_centavos > 0 ? <Text style={styles.warning}>Balance {formatPHP(order.balance_centavos)} must be settled before completing.</Text> : null}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status History</Text>
          {history.length === 0 ? (
            <Text style={styles.hint}>No history yet</Text>
          ) : (
            history.map((h) => (
              <View key={h.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View>
                  <Text style={styles.timelineStatus}>{h.to_status}</Text>
                  <Text style={styles.timelineDate}>{new Date(h.changed_at).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Row label="Name" value={order.customer_name_snapshot ?? '-'} />
          <Row label="Contact" value={customerContact || '-'} />
          <Row label="Customer ID" value={order.customer_id} mono />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Service (Snapshot)</Text>
          <Row label="Service" value={order.service_name_snapshot} />
          <Row
            label="Rate at time of order"
            value={
              order.pricing_type_snapshot === 'per_load'
                ? `${formatPHP(order.unit_price_snapshot_centavos)} / ${order.weight_block_grams_snapshot ? order.weight_block_grams_snapshot / 1000 : 8}kg`
                : order.pricing_type_snapshot === 'per_kg'
                  ? `${formatPHP(order.unit_price_snapshot_centavos)}/kg`
                  : order.pricing_type_snapshot === 'per_piece'
                    ? `${formatPHP(order.unit_price_snapshot_centavos)}/piece`
                    : formatPHP(order.unit_price_snapshot_centavos)
            }
          />
          <Row label="Pricing" value={order.pricing_type_snapshot} />
          <Row label="Unit Price" value={formatPHP(order.unit_price_snapshot_centavos)} />
          {order.pricing_type_snapshot === 'per_load' && order.weight_block_grams_snapshot ? (
            <Row label="Weight Block" value={`${order.weight_block_grams_snapshot / 1000}kg`} />
          ) : null}
          {order.weight_grams != null && <Row label="Weight" value={`${(order.weight_grams / 1000).toFixed(2)} kg (${order.weight_grams}g)`} />}
          {order.pricing_type_snapshot === 'per_load' && order.weight_grams != null && order.weight_block_grams_snapshot ? (
            <Row label="Loads" value={`${calcLoads(order.weight_grams, order.weight_block_grams_snapshot)}`} />
          ) : null}
          {order.quantity != null && <Row label="Quantity" value={`${order.quantity}`} />}
          {order.is_rush ? <Row label="Rush" value="Yes" /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <Row label="Base" value={formatPHP(order.base_cost_centavos)} />
          <Row label="Additional Fee" value={formatPHP(order.additional_fee_centavos)} />
          <Row label="Rush Fee" value={formatPHP(order.rush_fee_centavos)} />
          <View style={styles.divider} />
          <Row label="TOTAL" value={formatPHP(order.total_centavos)} bold />
          <Row label="Paid" value={formatPHP(order.amount_paid_centavos)} />
          <Row label="BALANCE" value={formatPHP(order.balance_centavos)} bold />
          <Row label="Payment Status" value={order.payment_status} />
        </View>

        {/* Payments */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          <View style={styles.paymentSummary}>
            <Text style={styles.paymentSummaryText}>Total: {formatPHP(order.total_centavos)} • Paid: {formatPHP(order.amount_paid_centavos)} • Balance: {formatPHP(order.balance_centavos)} • {order.payment_status}</Text>
          </View>
          {order.balance_centavos <= 0 ? <Text style={styles.paidHint}>This order is already fully paid.</Text> : null}
          <Text style={[styles.cardTitle, { marginTop: 12 }]}>Add Payment</Text>
          <View style={styles.methodRow}>
            {(['CASH', 'GCASH', 'OTHER'] as const).map((m) => (
              <Pressable key={m} onPress={() => setPaymentMethod(m)} style={[styles.methodChip, paymentMethod === m && styles.methodChipActive]}>
                <Text style={[styles.methodChipText, paymentMethod === m && styles.methodChipTextActive]}>{m === 'CASH' ? 'Cash' : m === 'GCASH' ? 'GCash' : 'Other'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addPaymentRow}>
            <TextInput placeholder="Amount ₱" value={paymentInput} onChangeText={setPaymentInput} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} />
            <Pressable onPress={() => void handleAddPayment()} disabled={paymentLoading || order.balance_centavos <= 0} style={[styles.addPaymentButton, (paymentLoading || order.balance_centavos <= 0) && { opacity: 0.6 }]}>
              {paymentLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addPaymentText}>Add Payment</Text>}
            </Pressable>
          </View>
          {(paymentMethod === 'GCASH' || paymentMethod === 'OTHER') && (
            <TextInput placeholder="Reference (optional)" value={paymentReference} onChangeText={setPaymentReference} style={[styles.input, { marginTop: 8 }]} />
          )}
          <TextInput placeholder="Notes (optional, e.g., Paid upon pickup)" value={paymentNotes} onChangeText={setPaymentNotes} style={[styles.input, { marginTop: 8 }]} />
          {paymentError ? <Text style={styles.error}>{paymentError}</Text> : null}
          <Text style={styles.hint}>Payment stored locally (PENDING), recalculates balance works offline. Append-only.</Text>
          {order.balance_centavos > 0 && (
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>After: Paid {formatPHP(order.amount_paid_centavos + (parseFloat(paymentInput) ? Math.round(parseFloat(paymentInput) * 100) : 0))} • Balance {formatPHP(Math.max(0, order.balance_centavos - (parseFloat(paymentInput) ? Math.round(parseFloat(paymentInput) * 100) : 0)))} • {(() => { const v = parseFloat(paymentInput) ? Math.round(parseFloat(paymentInput) * 100) : 0; const paid = order.amount_paid_centavos + v; if (paid <= 0) return 'UNPAID'; if (paid >= order.total_centavos) return 'PAID'; return 'PARTIAL'; })()}</Text>
            </View>
          )}

          <Text style={[styles.cardTitle, { marginTop: 16 }]}>Payment History</Text>
          {payments.length === 0 ? (
            <Text style={styles.hint}>No payments yet</Text>
          ) : (
            payments.map((p) => (
              <Pressable key={p.id} onPress={() => router.push({ pathname: '/payment-detail' as any, params: { id: p.id } })} style={styles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentDate}>{new Date(p.created_at).toLocaleString()} • {displayMethod((p as any).method)}</Text>
                  {(p as any).reference ? <Text style={styles.paymentRef}>Ref: {(p as any).reference}</Text> : null}
                  {(p as any).notes ? <Text style={styles.paymentNotes}>{(p as any).notes}</Text> : null}
                </View>
                <Text style={styles.paymentAmount}>{formatPHP(p.amount_centavos)}</Text>
              </Pressable>
            ))
          )}
          <View style={styles.divider} />
          <Row label="Total Paid" value={formatPHP(order.amount_paid_centavos)} bold />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status & Notes</Text>
          <Row label="Order Status" value={order.status} />
          <Row label="Payment" value={order.payment_status} />
          {order.notes ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.notes}>{order.notes}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>Snapshot preserved: old orders keep price at time of creation, not recalculated.</Text>
        </View>

        <Pressable onPress={handleDeleteOrder} style={styles.deleteButton}>
          <Text style={styles.deleteText}>Delete / Archive Order</Text>
        </Pressable>
        <Text style={styles.hint}>Archived orders disappear from active lists but payments/history remain. Soft-delete, syncs as tombstone.</Text>

        <Pressable onPress={() => router.back()} style={styles.buttonSecondary}>
          <Text style={styles.buttonSecondaryText}>Back to Orders</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono, bold && { fontWeight: '800', color: '#172554' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 8 },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  title: { color: '#172554', fontSize: 18, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 12, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  cardTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  orderNumber: { color: '#172554', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  badge: { alignSelf: 'center', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  badgeReceived: { backgroundColor: '#dbeafe' },
  badgeProcessing: { backgroundColor: '#fef3c7' },
  badgeReady: { backgroundColor: '#ffedd5' },
  badgeCompleted: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  subtitle: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 6 },
  aging: { color: '#d97706', fontSize: 12, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  agingLong: { color: '#b45309' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '600', flex: 1 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  notes: { color: '#334155', fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  statusBig: { color: '#172554', fontSize: 18, fontWeight: '800', textAlign: 'center', marginVertical: 8 },
  actionButton: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  actionProcessing: { backgroundColor: '#f59e0b' },
  actionReady: { backgroundColor: '#0ea5e9' },
  actionCompleted: { backgroundColor: '#10b981' },
  actionText: { color: '#fff', fontWeight: '800' },
  warning: { color: '#b91c1c', fontSize: 12, marginTop: 8, textAlign: 'center' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3157d5', marginRight: 12 },
  timelineStatus: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  timelineDate: { color: '#64748b', fontSize: 11 },
  paymentSummary: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10 },
  paymentSummaryText: { color: '#1e293b', fontSize: 12, fontWeight: '600' },
  paidHint: { color: '#15803d', fontSize: 12, marginTop: 8, textAlign: 'center', fontWeight: '600' },
  methodRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  methodChip: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  methodChipActive: { backgroundColor: '#172554', borderColor: '#172554' },
  methodChipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  methodChipTextActive: { color: '#fff' },
  addPaymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a' },
  addPaymentButton: { backgroundColor: '#3157d5', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  addPaymentText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  previewBox: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginTop: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  previewText: { color: '#166534', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  paymentDate: { color: '#475569', fontSize: 12 },
  paymentRef: { color: '#64748b', fontSize: 11, fontFamily: 'monospace' },
  paymentNotes: { color: '#334155', fontSize: 11, fontStyle: 'italic' },
  paymentAmount: { color: '#3157d5', fontWeight: '700', fontSize: 13 },
  button: { backgroundColor: '#3157d5', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
  buttonSecondary: { backgroundColor: '#e2e8f0', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  buttonSecondaryText: { color: '#1e293b', fontWeight: '600' },
  deleteButton: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  deleteText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
});
