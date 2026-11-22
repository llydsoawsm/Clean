import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getSyncStatus, runSync, type SyncStatus } from '@/sync/engine';
import { formatShortDate } from '@/utils/dates';
import { formatPHP } from '@/utils/money';
import { LoadingState } from '@/components/Feedback';
import { TabHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { useBottomNavPadding } from '@/components/BottomTabBar';
import { AppButton, Card, FormField, FormInput, KeyValueRow } from '@/components/ui';
import { theme } from '@/theme';

export default function SettingsScreen() {
  const { state, logout, updateShop } = useAuth();
  const bottomNavPadding = useBottomNavPadding();
  const toast = useToast();
  const session = state.status === 'authenticated' ? state.session : null;

  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ status: SyncStatus; pending: number; lastSyncAt: string | null }>({
    status: 'idle',
    pending: 0,
    lastSyncAt: null,
  });

  const [editingShop, setEditingShop] = useState(false);
  const [shopName, setShopName] = useState(session?.shop.name ?? '');
  const [shopContact, setShopContact] = useState(session?.shop.contact_number ?? '');
  const [shopAddress, setShopAddress] = useState(session?.shop.address ?? '');
  const [rushFee, setRushFee] = useState(
    session?.shop.rush_fee_centavos ? (session.shop.rush_fee_centavos / 100).toFixed(2) : '50.00'
  );
  const [savingShop, setSavingShop] = useState(false);

  const loadSyncStatus = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const s = await getSyncStatus(session.shop.id);
      setSyncInfo(s);
    } catch (e) {
      console.warn('[Settings] sync status error:', e);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadSyncStatus();
    }, [loadSyncStatus])
  );

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      await runSync(session.shop.id, session.token).catch(() => {});
      await loadSyncStatus();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    if (!session || syncing) return;
    setSyncing(true);
    try {
      const res = await runSync(session.shop.id, session.token);
      await loadSyncStatus();
      if (res.status === 'offline') {
        Alert.alert('Offline', 'Server unreachable right now. Changes stay saved on this device.');
      } else if (res.status === 'failed') {
        Alert.alert('Sync Incomplete', res.error ?? `${res.pendingAfter} change(s) pending.`);
      } else {
        toast.show('Synced', 'success');
      }
    } catch (e) {
      Alert.alert('Sync Failed', e instanceof Error ? e.message : 'Unable to sync right now.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveShop = async () => {
    if (!shopName.trim() || shopName.trim().length < 2) {
      Alert.alert('Required', 'Shop name must be at least 2 characters.');
      return;
    }
    const rushNum = parseFloat(rushFee);
    const rushCentavos = isNaN(rushNum) || rushNum < 0 ? 0 : Math.round(rushNum * 100);

    setSavingShop(true);
    try {
      await updateShop({
        name: shopName.trim(),
        contact_number: shopContact.trim() || null,
        address: shopAddress.trim() || null,
        rush_fee_centavos: rushCentavos,
      });
      setEditingShop(false);
      toast.show('Shop updated', 'success');
    } catch (e) {
      Alert.alert('Save Failed', e instanceof Error ? e.message : 'Unable to update shop.');
    } finally {
      setSavingShop(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      syncInfo.pending > 0
        ? `${syncInfo.pending} change(s) not synced yet. Your data stays on this device.`
        : 'Sign out of this shop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login' as any);
          },
        },
      ]
    );
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const syncSubtitle =
    syncInfo.pending > 0
      ? `${syncInfo.pending} pending`
      : syncInfo.lastSyncAt
        ? `Synced · ${formatShortDate(syncInfo.lastSyncAt)}`
        : 'Not synced yet';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TabHeader title="Shop" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomNavPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand}
              colors={[theme.colors.brand]}
            />
          }
        >
          {/* Shop Card */}
          <Card>
            <View style={styles.shopHeader}>
              <View style={styles.shopIcon}>
                <MaterialCommunityIcons name="storefront-outline" size={22} color={theme.colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {session.shop.name}
                </Text>
                <Text style={styles.ownerName} numberOfLines={1}>
                  {session.shop.owner_name ?? session.user.name}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!editingShop) {
                    setShopName(session.shop.name);
                    setShopContact(session.shop.contact_number ?? '');
                    setShopAddress(session.shop.address ?? '');
                    setRushFee((session.shop.rush_fee_centavos / 100).toFixed(2));
                  }
                  setEditingShop(!editingShop);
                }}
                hitSlop={8}
              >
                <Text style={styles.editLink}>{editingShop ? 'Cancel' : 'Edit'}</Text>
              </Pressable>
            </View>

            {editingShop ? (
              <View style={styles.editForm}>
                <FormField label="Shop name" first>
                  <FormInput value={shopName} onChangeText={setShopName} />
                </FormField>

                <FormField label="Phone">
                  <FormInput
                    value={shopContact}
                    onChangeText={setShopContact}
                    keyboardType="phone-pad"
                  />
                </FormField>

                <FormField label="Address">
                  <FormInput value={shopAddress} onChangeText={setShopAddress} />
                </FormField>

                <FormField label="Rush fee (₱)">
                  <FormInput
                    value={rushFee}
                    onChangeText={setRushFee}
                    keyboardType="decimal-pad"
                  />
                </FormField>

                <AppButton
                  label={savingShop ? 'Saving...' : 'Save'}
                  onPress={handleSaveShop}
                  loading={savingShop}
                  size="md"
                  style={styles.saveBtnSpacing}
                />
              </View>
            ) : (
              <View style={styles.infoList}>
                <KeyValueRow divider label="Phone" value={session.shop.contact_number || '—'} />
                <KeyValueRow divider multiline label="Address" value={session.shop.address || '—'} />
                <KeyValueRow
                  divider
                  label="Default Rush Fee"
                  value={formatPHP(session.shop.rush_fee_centavos)}
                />
              </View>
            )}
          </Card>

          {/* Manage Menu */}
          <Card noPadding>
            <Pressable
              onPress={() => router.push('/services' as any)}
              style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <MaterialCommunityIcons name="tag-outline" size={18} color={theme.colors.brand} />
                </View>
                <Text style={styles.menuTitle}>Services & Prices</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.inkMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/payments' as any)}
              style={({ pressed }) => [styles.menuRow, styles.menuDivider, pressed && styles.rowPressed]}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <MaterialCommunityIcons name="wallet-outline" size={18} color={theme.colors.brand} />
                </View>
                <Text style={styles.menuTitle}>Payments</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.inkMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/reports' as any)}
              style={({ pressed }) => [styles.menuRow, styles.menuDivider, pressed && styles.rowPressed]}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <MaterialCommunityIcons name="chart-bar" size={18} color={theme.colors.brand} />
                </View>
                <Text style={styles.menuTitle}>Reports</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.inkMuted} />
            </Pressable>
          </Card>

          {/* Sync Row */}
          <Card style={styles.syncCard}>
            <View style={styles.syncLeft}>
              <View style={styles.menuIcon}>
                <MaterialCommunityIcons
                  name={syncInfo.status === 'offline' ? 'cloud-off-outline' : 'sync'}
                  size={18}
                  color={theme.colors.brand}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Sync</Text>
                <Text style={styles.syncSub} numberOfLines={1}>
                  {syncSubtitle}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleSync}
              disabled={syncing}
              style={({ pressed }) => [
                styles.syncPillBtn,
                pressed && styles.btnPressed,
                syncing && styles.btnDisabled,
              ]}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.syncPillText}>Sync now</Text>
              )}
            </Pressable>
          </Card>

          {/* Account */}
          <Card noPadding>
            <View style={styles.accountInfoRow}>
              <Text style={styles.rowLabel}>Signed in</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {session.user.email}
              </Text>
            </View>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.menuRow, styles.menuDivider, pressed && styles.rowPressed]}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconDanger}>
                  <MaterialCommunityIcons name="logout" size={18} color={theme.colors.danger} />
                </View>
                <Text style={styles.logoutText}>Log Out</Text>
              </View>
            </Pressable>
          </Card>

          <Text style={styles.footerVersion}>Clean · v0.1.0</Text>
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
    paddingTop: theme.spacing.xs,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  ownerName: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  editLink: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  infoList: {
    marginTop: theme.spacing.md,
  },
  editForm: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.md,
  },
  saveBtnSpacing: {
    marginTop: theme.spacing.lg,
  },
  rowLabel: {
    color: theme.colors.inkMuted,
    fontSize: 13,
  },
  rowValue: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 13,
  },
  menuDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceWarm,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  syncCard: {
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  syncSub: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  syncPillBtn: {
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 82,
    alignItems: 'center',
  },
  btnPressed: {
    backgroundColor: theme.colors.brandDark,
  },
  btnDisabled: {
    opacity: theme.layout.disabledOpacity,
  },
  syncPillText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  accountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 13,
    gap: 12,
  },
  logoutText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  footerVersion: {
    color: theme.colors.inkMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
