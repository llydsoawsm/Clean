import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { initDatabase } from '@/db/client';
import { displayMethod, getPaymentWithOrder } from '@/db/repositories/payments';
import type { PaymentRow } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { formatShortDate } from '@/utils/dates';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AppButton,
  Card,
  Divider,
  KeyValueRow,
  useScreenBottomPadding,
} from '@/components/ui';
import { shortTicket, theme } from '@/theme';

type PaymentDetail = PaymentRow & { order_number: string; customer_name: string | null };

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomPadding = useScreenBottomPadding();
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Receipt" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!payment) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Receipt" />
        <EmptyState icon="receipt-text-outline" title="Receipt not found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Receipt" />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.amountBox}>
            <Text style={styles.amountValue}>{formatPHP(payment.amount_centavos)}</Text>
            <View style={styles.badgeWrap}>
              <StatusBadge type="payment" value="PAID" />
            </View>
          </View>

          <Divider spacing={theme.spacing.lg} />

          <KeyValueRow label="Customer" value={payment.customer_name ?? 'Customer'} />
          <KeyValueRow divider label="Order" value={shortTicket(payment.order_number)} />
          <KeyValueRow divider label="Method" value={displayMethod(payment.method)} />
          {payment.reference ? (
            <KeyValueRow divider label="Reference" value={payment.reference} />
          ) : null}
          {payment.notes ? (
            <KeyValueRow divider multiline label="Note" value={payment.notes} />
          ) : null}
          <KeyValueRow divider label="Date" value={formatShortDate(payment.created_at)} />

          <AppButton
            variant="soft"
            size="md"
            icon="receipt-text-outline"
            label="View Order"
            onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: payment.order_id } })}
            style={styles.orderBtn}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  card: {
    padding: theme.spacing.xl,
  },
  amountBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  amountValue: {
    color: theme.colors.ink,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badgeWrap: {
    marginTop: 8,
  },
  orderBtn: {
    marginTop: theme.spacing.lg,
  },
});
