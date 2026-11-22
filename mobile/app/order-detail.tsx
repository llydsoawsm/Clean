import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getOrderById, updateOrderStatus } from '@/db/repositories/orders';
import { addPayment, displayMethod, listPaymentsByOrder } from '@/db/repositories/payments';
import { listStatusHistory } from '@/db/repositories/statusHistory';
import { getCustomerById } from '@/db/repositories/customers';
import type { CustomerRow, OrderRow, OrderStatus, PaymentMethod, PaymentRow, StatusHistoryRow } from '@/db/types';
import { formatPHP, formatWeight } from '@/utils/money';
import { formatShortDate } from '@/utils/dates';
import { RushBadge, StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import {
  AppButton,
  Card,
  Divider,
  FormInput,
  KeyValueRow,
  OptionChips,
  SectionHeader,
  useScreenBottomPadding,
} from '@/components/ui';
import { ORDER_STATUS_META, shortTicket, theme, type MciIconName } from '@/theme';

const paymentMethods: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'GCASH', label: 'GCash' },
  { key: 'OTHER', label: 'Other' },
];

const PIPELINE_STEPS: OrderStatus[] = ['RECEIVED', 'PROCESSING', 'READY', 'COMPLETED'];

function actionSpec(order: OrderRow): { label: string; icon: MciIconName } {
  if (order.status === 'RECEIVED') return { label: 'Start Wash', icon: 'washing-machine' };
  if (order.status === 'PROCESSING') return { label: 'Mark Ready', icon: 'hanger' };
  if (order.balance_centavos > 0) {
    return { label: `Collect ${formatPHP(order.balance_centavos)} & Claim`, icon: 'cash' };
  }
  return { label: 'Claim Order', icon: 'check-circle-outline' };
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthSession();
  const toast = useToast();
  const bottomPadding = useScreenBottomPadding();

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
        'Unpaid Balance',
        `${formatPHP(order.balance_centavos)} remaining. Collect via ${displayMethod(paymentMethod)} and mark claimed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Collect ${formatPHP(order.balance_centavos)}`,
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
                toast.show('Order claimed', 'success');
                await load();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Unable to complete order.');
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
      toast.show(ORDER_STATUS_META[nextStatus].label, 'success');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to update status.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPayment = async () => {
    if (!order || !session || busy) return;
    const val = parseFloat(paymentAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Enter a payment amount.');
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
      toast.show(`Paid ${formatPHP(cents)}`, 'success');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Payment could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Ticket" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Ticket" />
        <EmptyState icon="basket-outline" title="Order not found" />
      </SafeAreaView>
    );
  }

  const currentIdx = PIPELINE_STEPS.indexOf(order.status);
  const unitLabel =
    order.pricing_type_snapshot === 'per_piece'
      ? `${order.quantity ?? 0} pc`
      : order.pricing_type_snapshot === 'fixed'
        ? 'Fixed'
        : formatWeight(order.weight_grams);
  const action = actionSpec(order);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={shortTicket(order.order_number)} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Claim Ticket Hero */}
          <Card>
            {/* 4-Step Laundry Pipeline */}
            <View style={styles.stepperRow}>
              {PIPELINE_STEPS.map((step, idx) => {
                const meta = ORDER_STATUS_META[step];
                const reached = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                const activeColor = ORDER_STATUS_META[order.status].color;
                return (
                  <View key={step} style={styles.stepItem}>
                    <View style={styles.stepTrackRow}>
                      <View
                        style={[
                          styles.stepLine,
                          idx === 0 && styles.stepLineHidden,
                          idx <= currentIdx && { backgroundColor: activeColor },
                        ]}
                      />
                      <View
                        style={[
                          styles.stepDot,
                          reached && { backgroundColor: activeColor, borderColor: activeColor },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={meta.icon}
                          size={13}
                          color={reached ? theme.colors.white : theme.colors.inkMuted}
                        />
                      </View>
                      <View
                        style={[
                          styles.stepLine,
                          idx === PIPELINE_STEPS.length - 1 && styles.stepLineHidden,
                          idx < currentIdx && { backgroundColor: activeColor },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        reached && { color: theme.colors.ink, fontWeight: isCurrent ? '700' : '600' },
                      ]}
                    >
                      {meta.shortLabel}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Divider />

            <View style={styles.ticketTop}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/customer-detail' as any, params: { id: order.customer_id } })
                }
                style={({ pressed }) => [styles.customerWrap, pressed && styles.pressed]}
              >
                <Text style={styles.customerName} numberOfLines={1}>
                  {order.customer_name_snapshot ?? customer?.name ?? 'Customer'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.inkMuted} />
              </Pressable>

              <View style={styles.badgeRow}>
                {order.is_rush === 1 ? <RushBadge /> : null}
                <StatusBadge type="order" value={order.status} />
              </View>
            </View>

            <Text style={styles.serviceSummary}>
              {order.service_name_snapshot} · {unitLabel}
            </Text>
            <Text style={styles.ticketMeta}>
              {formatShortDate(order.received_at)} · {order.order_number}
            </Text>

            {order.status !== 'COMPLETED' ? (
              <AppButton
                variant="primary"
                icon={action.icon}
                label={action.label}
                onPress={advanceStatus}
                disabled={busy}
                style={styles.statusBtnSpacing}
              />
            ) : null}
          </Card>

          {/* Receipt & Payment */}
          <Card>
            <SectionHeader
              title="Receipt"
              right={<StatusBadge type="payment" value={order.payment_status} />}
            />

            <KeyValueRow compact label="Base" value={formatPHP(order.base_cost_centavos)} />
            {order.additional_fee_centavos > 0 ? (
              <KeyValueRow compact label="Extra" value={formatPHP(order.additional_fee_centavos)} />
            ) : null}
            {order.rush_fee_centavos > 0 ? (
              <KeyValueRow compact label="Rush" value={formatPHP(order.rush_fee_centavos)} />
            ) : null}
            <KeyValueRow compact label="Total" value={formatPHP(order.total_centavos)} emphasis="bold" />
            <KeyValueRow compact label="Paid" value={formatPHP(order.amount_paid_centavos)} />
            <Divider />
            <KeyValueRow
              compact
              label="Balance"
              value={formatPHP(order.balance_centavos)}
              emphasis="total"
              valueColor={order.balance_centavos > 0 ? theme.colors.danger : theme.colors.claimed}
            />

            {order.balance_centavos > 0 ? (
              <View style={styles.paySection}>
                <OptionChips
                  options={paymentMethods}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  layout="equal"
                />

                <View style={styles.payBox}>
                  <FormInput
                    placeholder={`Max ${(order.balance_centavos / 100).toFixed(2)}`}
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="decimal-pad"
                    containerStyle={{ flex: 1 }}
                  />
                  <Pressable
                    onPress={() => setPaymentAmount((order.balance_centavos / 100).toFixed(2))}
                    style={({ pressed }) => [styles.exactBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.exactBtnText}>Full</Text>
                  </Pressable>
                </View>

                {paymentMethod !== 'CASH' ? (
                  <FormInput
                    placeholder="Reference #"
                    value={paymentRef}
                    onChangeText={setPaymentRef}
                    containerStyle={styles.payInputSpacing}
                  />
                ) : null}

                <FormInput
                  placeholder="Note (optional)"
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  containerStyle={styles.payInputSpacing}
                />

                <AppButton
                  variant="primary"
                  size="md"
                  label={busy ? 'Saving...' : 'Add Payment'}
                  onPress={handleAddPayment}
                  disabled={busy}
                  style={styles.payBtnSpacing}
                />
              </View>
            ) : (
              <View style={styles.paidInFullBanner}>
                <MaterialCommunityIcons name="check-circle" size={17} color={theme.colors.claimed} />
                <Text style={styles.paidInFullText}>Paid in full</Text>
              </View>
            )}
          </Card>

          {/* Payments History */}
          {payments.length > 0 ? (
            <Card>
              <SectionHeader title="Payments" style={styles.compactHeader} />
              {payments.map((p, idx) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/payment-detail' as any, params: { id: p.id } })}
                  style={({ pressed }) => [
                    styles.historyRow,
                    idx > 0 && styles.historyDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>
                      {displayMethod(p.method)}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </Text>
                    <Text style={styles.metaText}>{formatShortDate(p.created_at)}</Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.amountHighlight}>+{formatPHP(p.amount_centavos)}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.inkMuted} />
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}

          {/* Contact & Notes */}
          {customer?.contact_number || order.notes ? (
            <Card>
              {customer?.contact_number ? (
                <KeyValueRow compact label="Phone" value={customer.contact_number} />
              ) : null}
              {order.notes ? (
                <KeyValueRow
                  compact
                  multiline
                  divider={Boolean(customer?.contact_number)}
                  label="Note"
                  value={order.notes}
                />
              ) : null}
            </Card>
          ) : null}

          {/* Activity */}
          {history.length > 0 ? (
            <Card>
              <SectionHeader title="Activity" style={styles.compactHeader} />
              {history.map((h, idx) => {
                const label = ORDER_STATUS_META[h.to_status]?.label ?? h.to_status;
                return (
                  <View key={h.id} style={[styles.historyRow, idx > 0 && styles.historyDivider]}>
                    <Text style={styles.historyTitle}>{label}</Text>
                    <Text style={styles.metaText}>{formatShortDate(h.changed_at)}</Text>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.border,
  },
  stepLineHidden: {
    backgroundColor: 'transparent',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: theme.colors.inkMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 5,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  customerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  customerName: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceSummary: {
    color: theme.colors.inkSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  ticketMeta: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusBtnSpacing: {
    marginTop: theme.spacing.lg,
  },
  paySection: {
    marginTop: theme.spacing.md,
  },
  payBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  exactBtn: {
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  exactBtnText: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  payInputSpacing: {
    marginTop: 8,
  },
  payBtnSpacing: {
    marginTop: 10,
  },
  paidInFullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.claimedBg,
    borderRadius: theme.radius.md,
    padding: 10,
    marginTop: theme.spacing.md,
    justifyContent: 'center',
  },
  paidInFullText: {
    color: theme.colors.claimed,
    fontSize: 13,
    fontWeight: '700',
  },
  compactHeader: {
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  historyDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceWarm,
  },
  historyTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  metaText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  paymentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountHighlight: {
    color: theme.colors.claimed,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
});
