import { useCallback, useRef, useState } from 'react';
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
import { initDatabase } from '@/db/client';
import { deleteCustomer, getCustomerById, updateCustomer } from '@/db/repositories/customers';
import { listOrders } from '@/db/repositories/orders';
import type { OrderRow } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { LoadingState, EmptyState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import {
  AppButton,
  Card,
  FormField,
  FormInput,
  SectionHeader,
  useScreenBottomPadding,
} from '@/components/ui';
import { avatarTone, getInitials, shortTicket, theme } from '@/theme';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const bottomPadding = useScreenBottomPadding();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const initializedIdRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!id) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        try {
          await initDatabase();
          const [customer, orders] = await Promise.all([
            getCustomerById(id),
            listOrders({ customer_id: id, limit: 5 }),
          ]);
          if (cancelled) return;
          if (!customer) {
            setNotFound(true);
          } else {
            setNotFound(false);
            if (initializedIdRef.current !== id) {
              setName(customer.name);
              setContact(customer.contact_number);
              setAddress(customer.address ?? '');
              setNotes(customer.notes ?? '');
              initializedIdRef.current = id;
            }
            setRecentOrders(orders);
          }
        } catch {
          if (!cancelled) setNotFound(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const handleSave = async () => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Customer name is required.');
      return;
    }
    if (!contact.trim()) {
      Alert.alert('Required', 'Phone number is required.');
      return;
    }

    setSaving(true);
    try {
      await updateCustomer(id, {
        name: name.trim(),
        contact_number: contact.trim(),
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      toast.show('Customer updated', 'success');
      router.back();
    } catch (e) {
      Alert.alert('Update Failed', e instanceof Error ? e.message : 'Unable to update customer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Remove Customer', `Remove ${name}? Past orders stay saved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer(id);
            toast.show('Customer removed', 'info');
            router.back();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Unable to remove customer.');
          }
        },
      },
    ]);
  };

  const handleCreateOrder = () => {
    if (id) {
      router.push({ pathname: '/receive' as any, params: { customerId: id } });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Customer" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Customer" />
        <EmptyState icon="account-group-outline" title="Customer not found" />
      </SafeAreaView>
    );
  }

  const tone = avatarTone(name);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Customer" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Hero Card */}
          <Card>
            <View style={styles.profileTop}>
              <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                <Text style={[styles.avatarText, { color: tone.fg }]}>{getInitials(name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.profilePhone}>{contact}</Text>
              </View>
            </View>

            <AppButton
              variant="soft"
              size="md"
              icon="plus"
              label="New Drop-off"
              onPress={handleCreateOrder}
            />
          </Card>

          {/* Edit Details Card */}
          <Card>
            <SectionHeader title="Details" />

            <FormField label="Name" first>
              <FormInput value={name} onChangeText={setName} />
            </FormField>

            <FormField label="Phone">
              <FormInput
                value={contact}
                onChangeText={setContact}
                keyboardType="phone-pad"
                placeholder="0917-000-0000"
              />
            </FormField>

            <FormField label="Address">
              <FormInput
                value={address}
                onChangeText={setAddress}
                placeholder="Street or Barangay"
              />
            </FormField>

            <FormField label="Notes">
              <FormInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Preferences..."
              />
            </FormField>

            <AppButton
              variant="primary"
              label={saving ? 'Saving...' : 'Save'}
              onPress={handleSave}
              loading={saving}
              style={styles.submitBtn}
            />
          </Card>

          {/* Recent Orders */}
          {recentOrders.length > 0 ? (
            <Card>
              <SectionHeader title="Recent Orders" style={styles.compactHeader} />
              {recentOrders.map((ord, idx) => (
                <Pressable
                  key={ord.id}
                  onPress={() => router.push({ pathname: '/order-detail' as any, params: { id: ord.id } })}
                  style={({ pressed }) => [
                    styles.orderRow,
                    idx > 0 && styles.orderDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle}>
                      {shortTicket(ord.order_number)} · {ord.service_name_snapshot}
                    </Text>
                    <Text style={styles.orderPrice}>{formatPHP(ord.total_centavos)}</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <StatusBadge type="order" value={ord.status} />
                    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.inkMuted} />
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}

          <AppButton
            variant="dangerSoft"
            size="md"
            icon="trash-can-outline"
            label="Remove customer"
            onPress={handleDelete}
          />
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
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileName: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  profilePhone: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: theme.spacing.xl,
  },
  compactHeader: {
    marginBottom: 4,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  orderDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceWarm,
  },
  orderTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  orderPrice: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  orderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
