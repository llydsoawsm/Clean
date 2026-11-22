import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase } from '@/db/client';
import { displayMethod, getPaymentWithOrder } from '@/db/repositories/payments';
import type { PaymentRow } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { formatDate } from '@/utils/dates';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { StatusBadge } from '@/components/StatusBadge';

type PaymentDetail = PaymentRow & { order_number: string; customer_name: string | null };

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        await initDatabase();
        const row = await getPaymentWithOrder(id);
        if (!cancelled) setPayment(row);
      } catch (e) {
        console.warn('[PaymentDetail] load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading payment..." />
      </SafeAreaView>
    );
  }

  if (!payment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Payment Not Found</Text>
          <View style={{ width: 50 }} />
        </View>
        <EmptyState title="Payment Not Found" hint="The payment record could not be located." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Payment Details</Text>
          <StatusBadge type="sync" value={payment.sync_status} />
        </View>

        <View style={styles.card}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount Received</Text>
            <Text style={styles.amountValue}>{formatPHP(payment.amount_centavos)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Customer</Text>
            <Text style={styles.rowValue}>{payment.customer_name ?? 'Customer'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Order</Text>
            <Text style={styles.rowValue}>{payment.order_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Payment Method</Text>
            <Text style={styles.rowValue}>{displayMethod(payment.method)}</Text>
          </View>
          {payment.reference ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reference No.</Text>
              <Text style={styles.rowValue}>{payment.reference}</Text>
            </View>
          ) : null}
          {payment.notes ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Notes</Text>
              <Text style={[styles.rowValue, { flex: 1, textAlign: 'right', marginLeft: 12 }]}>{payment.notes}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Date & Time</Text>
            <Text style={styles.rowValue}>{formatDate(payment.created_at)}</Text>
          </View>

          <Pressable
            onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: payment.order_id } })}
            style={styles.orderBtn}
          >
            <Text style={styles.orderBtnText}>View Order {payment.order_number}</Text>
          </Pressable>
        </View>
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  amountBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  amountLabel: { color: '#1e40af', fontSize: 12, fontWeight: '500' },
  amountValue: { color: '#1d4ed8', fontSize: 24, fontWeight: '700', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  orderBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 16,
  },
  orderBtnText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
});
