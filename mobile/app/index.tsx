import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { orderStore } from '@/store/orderStore';

export default function HomeScreen() {
  const [orderCounts, setOrderCounts] = useState(orderStore.getCounts());
  const [paymentSummary, setPaymentSummary] = useState(orderStore.getFinancials());

  useEffect(() => {
    const unsub = orderStore.subscribe(() => {
      setOrderCounts(orderStore.getCounts());
      setPaymentSummary(orderStore.getFinancials());
    });
    return unsub;
  }, []);

  const session = {
    shop: { id: 'shop-1', name: 'Clean Laundry' },
    user: { id: 'usr-1', name: 'Juan Dela Cruz' },
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Minimalist Blue Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.brandIconBox}>
              <Ionicons name="water" size={20} color="#1d4ed8" />
            </View>
            <View>
              <Text style={styles.shopTitle}>{session.shop.name}</Text>
              <View style={styles.statusIndicator}>
                <View style={styles.blueDot} />
                <Text style={styles.statusLabel}>Online • System Active</Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/settings' as any)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={19} color="#1e40af" />
          </Pressable>
        </View>

        {/* Primary Action Button - Solid Minimalist Blue */}
        <Pressable
          onPress={() => router.push('/receive' as any)}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        >
          <View style={styles.primaryBtnLeft}>
            <View style={styles.primaryPlusBox}>
              <Ionicons name="add" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.primaryBtnText}>New Laundry Order</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#93c5fd" />
        </Pressable>

        {/* Today's Orders - Minimalist Blue Overview */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Today's Orders</Text>
          <Text style={styles.sectionBadge}>
            {orderCounts.ALL === 0 ? '0 orders today' : `${orderCounts.ALL} total`}
          </Text>
        </View>

        <View style={styles.orderRow}>
          <Pressable
            onPress={() => router.push('/orders' as any)}
            style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}
          >
            <Text style={styles.orderCount}>{orderCounts.RECEIVED}</Text>
            <Text style={styles.orderLabel}>Received</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/orders' as any)}
            style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}
          >
            <Text style={styles.orderCount}>{orderCounts.PROCESSING}</Text>
            <Text style={styles.orderLabel}>Washing</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/orders' as any)}
            style={({ pressed }) => [styles.orderCard, styles.orderCardHighlight, pressed && styles.cardPressed]}
          >
            <Text style={[styles.orderCount, styles.orderCountHighlight]}>{orderCounts.READY}</Text>
            <Text style={[styles.orderLabel, styles.orderLabelHighlight]}>Ready</Text>
          </Pressable>
        </View>

        {/* Financial Summary */}
        <Pressable
          onPress={() => router.push('/reports' as any)}
          style={({ pressed }) => [styles.summaryCard, pressed && styles.cardPressed]}
        >
          <View style={styles.summaryCol}>
            <Text style={styles.summaryCaption}>Collected Today</Text>
            <Text style={styles.summaryAmount}>₱{(paymentSummary.collectedToday / 100).toFixed(2)}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryCol}>
            <Text style={styles.summaryCaption}>Unpaid Balance</Text>
            <Text style={[styles.summaryAmount, styles.summaryAmountMuted]}>
              ₱{(paymentSummary.outstandingBalance / 100).toFixed(2)}
            </Text>
          </View>
        </Pressable>

        {/* Management Grid */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Manage</Text>
        </View>

        <View style={styles.grid}>
          <Pressable
            onPress={() => router.push('/orders' as any)}
            style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="receipt-outline" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.gridTitle}>Orders</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/customers' as any)}
            style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="people-outline" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.gridTitle}>Customers</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/services' as any)}
            style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="pricetag-outline" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.gridTitle}>Services</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/payments' as any)}
            style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="wallet-outline" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.gridTitle}>Payments</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/reports' as any)}
            style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="bar-chart-outline" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.gridTitle}>Reports</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/settings' as any)}
            style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
          >
            <View style={styles.gridIconCircle}>
              <Ionicons name="settings-outline" size={20} color="#1d4ed8" />
            </View>
            <Text style={styles.gridTitle}>Settings</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Clean Laundry • System Live & Active</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
  },
  statusLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.7,
  },
  primaryBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  primaryBtnPressed: {
    backgroundColor: '#1e40af',
  },
  primaryBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryPlusBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionBadge: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  orderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  orderCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderCardHighlight: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  orderCount: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '700',
  },
  orderCountHighlight: {
    color: '#1d4ed8',
  },
  orderLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  orderLabelHighlight: {
    color: '#1e40af',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryCol: {
    flex: 1,
  },
  summaryCaption: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  summaryAmount: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryAmountMuted: {
    color: '#1e40af',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  gridItem: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '600',
  },
  cardPressed: {
    opacity: 0.7,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
});
