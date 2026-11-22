import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { getSyncStatus, runSync, type SyncStatus } from '@/sync/engine';
import { formatDate } from '@/utils/dates';
import { formatPHP } from '@/utils/money';
import { useToast } from '@/components/Toast';

export default function SettingsScreen() {
  const { state, logout, updateShop } = useAuth();
  const toast = useToast();
  const session = state.status === 'authenticated' ? state.session : null;

  const [syncing, setSyncing] = useState(false);
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

  const handleSync = async () => {
    if (!session || syncing) return;
    setSyncing(true);
    try {
      const res = await runSync(session.shop.id, session.token);
      await loadSyncStatus();
      if (res.status === 'offline') {
        Alert.alert('Offline', 'Clean server is currently unreachable. Your local changes are safe and will sync later.');
      } else if (res.status === 'failed') {
        Alert.alert('Sync Incomplete', res.error ?? `${res.pendingAfter} change(s) still pending.`);
      } else {
        toast.show(`Synced! Pushed ${res.pushed}, pulled ${res.pulled}`, 'success');
      }
    } catch (e) {
      Alert.alert('Sync Failed', e instanceof Error ? e.message : 'Unable to synchronize right now.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveShop = async () => {
    if (!shopName.trim() || shopName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Shop name must be at least 2 characters.');
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
      toast.show('Shop details updated', 'success');
    } catch (e) {
      Alert.alert('Save Failed', e instanceof Error ? e.message : 'Unable to save shop details.');
    } finally {
      setSavingShop(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      syncInfo.pending > 0
        ? `You have ${syncInfo.pending} pending offline change(s). Logging out keeps your local data safe until you sign back in.`
        : 'Are you sure you want to log out?',
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

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Sync Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Cloud Synchronization</Text>
              <View style={styles.statusPill}>
                <View style={[styles.blueDot, syncInfo.status === 'offline' && styles.offlineDot]} />
                <Text style={styles.statusText}>
                  {syncing
                    ? 'Syncing'
                    : syncInfo.pending > 0
                      ? `${syncInfo.pending} Pending`
                      : syncInfo.status === 'offline'
                        ? 'Offline'
                        : 'Synced'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>
              {syncInfo.lastSyncAt
                ? `Last synced: ${formatDate(syncInfo.lastSyncAt)}`
                : 'Not synced yet. Tap Sync Now when connected to your server.'}
            </Text>

            <Pressable onPress={handleSync} disabled={syncing} style={[styles.syncBtn, syncing && styles.btnDisabled]}>
              <Ionicons name="sync-outline" size={16} color="#ffffff" />
              <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
            </Pressable>
          </View>

          {/* Shop Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Shop Details</Text>
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
              >
                <Text style={styles.editLink}>{editingShop ? 'Cancel' : 'Edit'}</Text>
              </Pressable>
            </View>

            {editingShop ? (
              <View>
                <Text style={styles.inputLabel}>Shop Name</Text>
                <TextInput style={styles.input} value={shopName} onChangeText={setShopName} />

                <Text style={styles.inputLabel}>Contact Number</Text>
                <TextInput style={styles.input} value={shopContact} onChangeText={setShopContact} keyboardType="phone-pad" />

                <Text style={styles.inputLabel}>Address</Text>
                <TextInput style={styles.input} value={shopAddress} onChangeText={setShopAddress} />

                <Text style={styles.inputLabel}>Default Rush Fee (₱)</Text>
                <TextInput style={styles.input} value={rushFee} onChangeText={setRushFee} keyboardType="decimal-pad" />

                <Pressable
                  onPress={handleSaveShop}
                  disabled={savingShop}
                  style={[styles.syncBtn, { marginTop: 12 }, savingShop && styles.btnDisabled]}
                >
                  <Text style={styles.syncBtnText}>{savingShop ? 'Saving...' : 'Save Shop Details'}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Shop Name</Text>
                  <Text style={styles.rowValue}>{session.shop.name}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Owner</Text>
                  <Text style={styles.rowValue}>{session.shop.owner_name ?? session.user.name}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Contact</Text>
                  <Text style={styles.rowValue}>{session.shop.contact_number || 'Not set'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Address</Text>
                  <Text style={[styles.rowValue, { flex: 1, textAlign: 'right', marginLeft: 12 }]}>
                    {session.shop.address || 'Not set'}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Default Rush Fee</Text>
                  <Text style={styles.rowValue}>{formatPHP(session.shop.rush_fee_centavos)}</Text>
                </View>
              </>
            )}
          </View>

          {/* User Account */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Name</Text>
              <Text style={styles.rowValue}>{session.user.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{session.user.email}</Text>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.brandIconBox}>
                <Ionicons name="water" size={20} color="#1d4ed8" />
              </View>
              <View>
                <Text style={styles.appName}>Clean</Text>
                <Text style={styles.appVer}>Version 0.1.0 • Offline-First</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '700' },
  container: { padding: 18, paddingBottom: 40 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  editLink: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  cardDesc: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  blueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1d4ed8' },
  offlineDot: { backgroundColor: '#94a3b8' },
  statusText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  syncBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  inputLabel: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  appName: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  appVer: { color: '#64748b', fontSize: 12 },
  logoutBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});
