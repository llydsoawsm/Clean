import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View, ScrollView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getPendingBreakdown } from '@/sync/push';
import { runSync, getLastSyncResult, checkApiReachable } from '@/sync/engine';
import { getLastSyncCursor } from '@/sync/cursor';
import { getDatabase } from '@/db/client';

export default function SettingsScreen() {
  const { state, logout } = useAuth();
  const session = state.status === 'authenticated' ? state.session : null;
  const [pending, setPending] = useState<Record<string, number> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ReturnType<typeof getLastSyncResult>>(null);
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');

  const loadSync = useCallback(async () => {
    if (!session) return;
    try {
      const b = await getPendingBreakdown(session.shop.id);
      setPending(b);
      const cursor = await getLastSyncCursor(session.shop.id);
      setLastSyncAt(cursor);
      setLastResult(getLastSyncResult());
      const reachable = await checkApiReachable();
      setHealth(reachable ? 'online' : 'offline');
    } catch {}
  }, [session]);

  useEffect(() => {
    void loadSync();
  }, [loadSync]);

  const handleSync = async () => {
    if (!session || syncing) return;
    setSyncing(true);
    try {
      const res = await runSync(session.shop.id, session.token);
      setLastResult(res);
      await loadSync();
      if (res.status === 'synced') Alert.alert('Synced', `Uploaded ${res.pushed} • Downloaded ${res.pulled} • All data synced`);
      else if (res.status === 'offline') Alert.alert('Offline', 'API unreachable — data stays pending until reconnect');
      else if (res.status === 'failed') Alert.alert('Sync incomplete', `Pending ${res.pendingAfter} • ${res.error ?? ''}`);
    } catch (e) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'You will need internet to log in again. Local laundry data will stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login' as any);
        },
      },
    ]);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Not logged in</Text>
          <Pressable onPress={() => router.replace('/login' as any)} style={styles.button}>
            <Text style={styles.buttonText}>Go to Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const syncLabel = syncing ? 'Syncing...' : pending && pending.total > 0 ? `${pending.total} Pending` : health === 'offline' ? 'Offline' : lastResult?.status === 'synced' ? 'Synced' : 'Idle';
  const syncColor = syncing ? '#0ea5e9' : pending && pending.total > 0 ? '#f59e0b' : health === 'offline' ? '#94a3b8' : '#16a34a';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Profile & Shop • Sync</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Synchronization</Text>
          <View style={[styles.syncBadge, { backgroundColor: syncColor + '20', borderColor: syncColor }]}>
            <Text style={[styles.syncBadgeText, { color: syncColor }]}>{syncLabel}</Text>
          </View>
          <View style={styles.syncGrid}>
            <View style={styles.syncBox}>
              <Text style={styles.syncLabel}>Pending</Text>
              <Text style={styles.syncValue}>{pending?.total ?? 0}</Text>
              <Text style={styles.syncHint}>{pending ? `${pending.customers ?? 0} cust • ${pending.services ?? 0} svc • ${pending.orders ?? 0} ord • ${pending.payments ?? 0} pay • ${pending.statusHistory ?? 0} hist` : 'loading'}</Text>
            </View>
            <View style={styles.syncBox}>
              <Text style={styles.syncLabel}>Last Synced</Text>
              <Text style={styles.syncValueSmall}>{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}</Text>
              <Text style={styles.syncHint}>{health === 'online' ? 'API online' : health === 'offline' ? 'API offline' : 'checking'}</Text>
            </View>
          </View>
          <Pressable onPress={handleSync} disabled={syncing} style={[styles.button, syncing && { opacity: 0.6 }]}>
            {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sync Now</Text>}
          </Pressable>
          <Text style={styles.note}>Sync order: Customers → Services → Orders → Payments → Status History. Retries safe (idempotent). Pulls server changes after push. Shop-scoped.</Text>
          {lastResult && (
            <View style={styles.logBox}>
              <Text style={styles.logTitle}>Last Sync: {lastResult.status} • {new Date(lastResult.at).toLocaleString()}</Text>
              <Text style={styles.logText}>Pushed {lastResult.pushed} • Pulled {lastResult.pulled} • Pending {lastResult.pendingAfter}{lastResult.error ? ` • ${lastResult.error}` : ''}</Text>
            </View>
          )}
          <Text style={styles.note}>Triggers: after login, foreground, after mutation, Sync Now, connectivity returns. No aggressive polling.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Owner</Text>
          <Row label="Name" value={session.user.name} />
          <Row label="Email" value={session.user.email} />
          <Row label="User ID" value={session.user.id} mono />
          <Row label="Created" value={new Date(session.user.created_at).toLocaleString()} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop</Text>
          <Row label="Shop Name" value={session.shop.name} />
          <Row label="Owner" value={session.shop.owner_name ?? '-'} />
          <Row label="Shop ID" value={session.shop.id} mono />
          <Row label="Contact" value={session.shop.contact_number ?? '-'} />
          <Row label="Address" value={session.shop.address ?? '-'} />
          <Row label="Currency" value={session.shop.currency} />
          <Row label="Rush Fee" value={`₱${(session.shop.rush_fee_centavos / 100).toFixed(2)}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Row label="Token" value={`${session.token.slice(0, 18)}...`} mono />
          <Text style={styles.note}>Token securely stored with expo-secure-store. Offline open uses cached session until expiry (7 days).</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About Clean</Text>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Image source={require('../assets/clean-logo.png')} style={{ width: 72, height: 72, borderRadius: 12 }} resizeMode="contain" />
          </View>
          <Text style={styles.aboutTitle}>Clean</Text>
          <Text style={styles.aboutVersion}>Version 0.1.0 • Expo SDK 54</Text>
          <Text style={styles.aboutDesc}>Offline-first laundry shop management system. Clean keeps your shop running without internet — orders, customers, services, payments, reports, and sync.</Text>
          <Text style={styles.note}>© 2026 Clean. All rights reserved. Built with React Native + Expo + SQLite.</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
        <Text style={styles.logoutHint}>Local orders, customers, services stay on device (PENDING preserved).</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { padding: 6 },
  backText: { color: '#3157d5', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#172554', fontSize: 18, fontWeight: '800' },
  title: { color: '#172554', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  cardTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  syncBadge: { alignSelf: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  syncBadgeText: { fontSize: 12, fontWeight: '700' },
  syncGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  syncBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  syncLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  syncValue: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginTop: 4 },
  syncValueSmall: { color: '#0f172a', fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  syncHint: { color: '#94a3b8', fontSize: 10, marginTop: 2, textAlign: 'center' },
  logBox: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, marginTop: 12 },
  logTitle: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  logText: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '600', flex: 1 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  note: { color: '#64748b', fontSize: 11, marginTop: 10, lineHeight: 14, fontStyle: 'italic' },
  logoutButton: { backgroundColor: '#dc2626', borderRadius: 10, marginTop: 24, padding: 14 },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  logoutHint: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 8 },
  secondaryButton: { backgroundColor: '#e2e8f0', borderRadius: 10, marginTop: 12, padding: 14 },
  secondaryText: { color: '#1e293b', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 18, padding: 14 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  aboutTitle: { color: '#172554', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  aboutVersion: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 4 },
  aboutDesc: { color: '#334155', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
