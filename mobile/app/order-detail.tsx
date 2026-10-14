import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPHP } from '@/utils/money';
import { orderStore, LocalOrder } from '@/store/orderStore';
import type { OrderStatus } from '@/db/types';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<LocalOrder | undefined>(() => {
    if (id) return orderStore.getById(id);
    return orderStore.getAll()[0];
  });

  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    const sync = () => {
      if (id) {
        setOrder(orderStore.getById(id));
      } else {
        setOrder(orderStore.getAll()[0]);
      }
    };
    sync();
    const unsub = orderStore.subscribe(sync);
    return unsub;
  }, [id]);

  const advanceStatus = () => {
    if (!order) return;
    const nextStatus: OrderStatus =
      order.status === 'RECEIVED' ? 'PROCESSING' : order.status === 'PROCESSING' ? 'READY' : 'COMPLETED';

    if (nextStatus === 'COMPLETED' && order.balance_centavos > 0) {
      Alert.alert(
        'Payment Required',
        `This order cannot be completed because there is an unpaid balance of ${formatPHP(order.balance_centavos)}.\n\nWould you like to collect and settle the remaining balance now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Settle ${formatPHP(order.balance_centavos)}`,
            onPress: () => {
              orderStore.addPayment(order.id, order.balance_centavos, 'CASH');
              orderStore.updateStatus(order.id, 'COMPLETED');
              Alert.alert('Order Completed', `Payment settled in full and order ${order.order_number} marked as Completed.`);
            },
          },
        ]
      );
      return;
    }

    const res = orderStore.updateStatus(order.id, nextStatus);
    if (!res.success && res.error) {
      Alert.alert('Cannot Update Status', res.error);
    }
  };

  const handleAddPayment = () => {
    const val = parseFloat(paymentAmount);
    if (!val || val <= 0 || !order) return;
    const cents = Math.round(val * 100);

    orderStore.addPayment(order.id, cents, 'CASH');
    setPaymentAmount('');
    Alert.alert('Payment Recorded', `Successfully received ${formatPHP(cents)} for ${order.order_number}`);
  };

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
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>The requested order could not be located.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>{order.order_number}</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.customerName}>{order.customer_name}</Text>
            <View
              style={[
                styles.badge,
                order.status === 'READY'
                  ? styles.badgeReady
                  : order.status === 'PROCESSING'
                    ? styles.badgeProcessing
                    : order.status === 'RECEIVED'
                      ? styles.badgeReceived
                      : styles.badgeCompleted,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  order.status === 'READY' && styles.badgeTextReady,
                  order.status === 'PROCESSING' && styles.badgeTextProcessing,
                  order.status === 'RECEIVED' && styles.badgeTextReceived,
                ]}
              >
                {order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.serviceName}>{order.service_name}</Text>
          <Text style={styles.metaText}>Created {new Date(order.created_at).toLocaleString()}</Text>

          {order.status !== 'COMPLETED' && (
            <Pressable
              onPress={advanceStatus}
              style={[
                styles.statusActionBtn,
                order.status === 'READY' && order.balance_centavos > 0 && styles.statusActionBtnPending,
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

        {/* Pricing / Balance Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Status</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total</Text>
            <Text style={styles.rowValue}>{formatPHP(order.total_centavos)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Paid</Text>
            <Text style={styles.rowValue}>{formatPHP(order.paid_centavos)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabelBold}>Balance</Text>
            <Text style={styles.rowBalance}>{formatPHP(order.balance_centavos)}</Text>
          </View>

          {order.balance_centavos > 0 ? (
            <View style={styles.payBox}>
              <TextInput
                placeholder="Amount to pay"
                placeholderTextColor="#94a3b8"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                style={styles.payInput}
              />
              <Pressable onPress={handleAddPayment} style={styles.payBtn}>
                <Text style={styles.payBtnText}>Add Payment</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.paidInFullBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#1d4ed8" />
              <Text style={styles.paidInFullText}>Paid in Full</Text>
            </View>
          )}
        </View>

        {/* Customer Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer Information</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{order.customer_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Contact</Text>
            <Text style={styles.rowValue}>{order.customer_contact || 'None provided'}</Text>
          </View>
          {order.notes ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Special Instructions</Text>
              <Text style={styles.rowValue}>{order.notes}</Text>
            </View>
          ) : null}
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#0f172a', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  customerName: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeReceived: { backgroundColor: '#eff6ff' },
  badgeProcessing: { backgroundColor: '#dbeafe' },
  badgeReady: { backgroundColor: '#1d4ed8' },
  badgeCompleted: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  badgeTextReceived: { color: '#1d4ed8' },
  badgeTextProcessing: { color: '#1e40af' },
  badgeTextReady: { color: '#ffffff' },
  serviceName: { color: '#475569', fontSize: 13, marginTop: 4 },
  metaText: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  statusActionBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  statusActionBtnPending: {
    backgroundColor: '#1e40af',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  statusActionText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowLabelBold: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  rowBalance: { color: '#1d4ed8', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  payBox: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
  payBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
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
});
