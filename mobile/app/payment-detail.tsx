import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPHP } from '@/utils/money';
import { orderStore, LocalPayment } from '@/store/orderStore';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [payment, setPayment] = useState<LocalPayment | undefined>(() => {
    const list = orderStore.getAllPayments();
    if (id) return list.find((p) => p.id === id);
    return list[0];
  });

  useEffect(() => {
    const list = orderStore.getAllPayments();
    if (id) {
      setPayment(list.find((p) => p.id === id));
    } else {
      setPayment(list[0]);
    }
  }, [id]);

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
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>The payment record was not found.</Text>
        </View>
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
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount Received</Text>
            <Text style={styles.amountValue}>{formatPHP(payment.amount_centavos)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Customer</Text>
            <Text style={styles.rowValue}>{payment.customer_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Order</Text>
            <Text style={styles.rowValue}>{payment.order_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Payment Method</Text>
            <Text style={styles.rowValue}>{payment.method}</Text>
          </View>
          {payment.reference ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reference No.</Text>
              <Text style={styles.rowValue}>{payment.reference}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Date & Time</Text>
            <Text style={styles.rowValue}>{new Date(payment.created_at).toLocaleString()}</Text>
          </View>
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
  amountBox: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#dbeafe' },
  amountLabel: { color: '#1e40af', fontSize: 12, fontWeight: '500' },
  amountValue: { color: '#1d4ed8', fontSize: 24, fontWeight: '700', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
});
