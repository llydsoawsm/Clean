import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getPaymentWithOrder, displayMethod } from '@/db/repositories/payments';
import { getCustomerById } from '@/db/repositories/customers';
import { formatPHP } from '@/utils/money';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [payment, setPayment] = useState<any | null>(null);
  const [customerContact, setCustomerContact] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getPaymentWithOrder(id as string);
      if (!row) {
        setError('Payment not found');
        return;
      }
      setPayment(row);
      // try to get customer contact via order? need order's customer_id, fetch customer
      // payment has order_id, we could get order's customer, but we have order_number only; fetch via order repo
      // instead use customers directly if we can find order's customer
      const { getOrderById } = await import('@/db/repositories/orders');
      const order = await getOrderById(row.order_id);
      if (order) {
        const cust = await getCustomerById(order.customer_id).catch(() => null);
        setCustomerContact(cust?.contact_number ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#3157d5" />
          <Text style={styles.hint}>Loading payment...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (error || !payment) {
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

  const methodDisplay = displayMethod(payment.method);
  const isLegacy = !payment.method || (payment.method.toLowerCase() !== 'cash' && payment.method.toLowerCase() !== 'gcash' && payment.method.toLowerCase() !== 'other');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Payment Details</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.amount}>{formatPHP(payment.amount_centavos)}</Text>
          <View style={styles.methodBadge}>
            <Text style={styles.methodText}>{isLegacy ? 'Legacy Payment' : methodDisplay}</Text>
          </View>
          <Text style={styles.subtitle}>{new Date(payment.created_at).toLocaleString()}</Text>
          {payment.reference ? <Text style={styles.ref}>Ref: {payment.reference}</Text> : null}
          {payment.notes ? <Text style={styles.notes}>{payment.notes}</Text> : null}
          <Text style={styles.hint}>Sync: {payment.sync_status} • {payment.is_deleted ? 'Deleted' : 'Active'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order</Text>
          <Row label="Order Number" value={payment.order_number ?? payment.order_id} mono bold />
          <Row label="Customer" value={payment.customer_name ?? '-'} />
          {customerContact ? <Row label="Contact" value={customerContact} /> : null}
          <Row label="Order ID" value={payment.order_id} mono />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Info</Text>
          <Row label="Amount" value={formatPHP(payment.amount_centavos)} bold />
          <Row label="Method" value={isLegacy ? 'Unknown / Legacy' : methodDisplay} />
          {payment.reference ? <Row label="Reference" value={payment.reference} mono /> : null}
          {payment.notes ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.notes}>{payment.notes}</Text>
            </View>
          ) : null}
          <Row label="Date/Time" value={new Date(payment.created_at).toLocaleString()} />
          <Row label="Payment ID" value={payment.id} mono />
        </View>

        <Pressable onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: payment.order_id } })} style={styles.primaryButton}>
          <Text style={styles.primaryText}>View Order Details</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Back to Payments</Text>
        </Pressable>

        <Text style={styles.footerHint}>Payments are append-only financial records. Corrections require explicit refund/correction flow (not in Phase 7).</Text>
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
  amount: { color: '#3157d5', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  methodBadge: { alignSelf: 'center', backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  methodText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 6 },
  ref: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 4, fontFamily: 'monospace' },
  notes: { color: '#334155', fontSize: 13, marginTop: 4, fontStyle: 'italic', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '600', flex: 1 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  primaryButton: { backgroundColor: '#3157d5', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#e2e8f0', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  secondaryText: { color: '#1e293b', fontWeight: '600' },
  button: { backgroundColor: '#3157d5', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
  footerHint: { color: '#94a3b8', fontSize: 11, marginTop: 16, textAlign: 'center', fontStyle: 'italic' },
});
