import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { api } from '@/services/api';
import type { HealthResponse } from '@/types/health';
import { useDbInit } from '@/hooks/useDbInit';
import { runDevDbTest, getLocalDbStats } from '@/db/devTest';
import { useAuth } from '@/context/AuthContext';
import { getOrderCounts } from '@/db/repositories/orders';
import { getPaymentSummary } from '@/db/repositories/payments';
import { OfflineBanner } from '@/components/OfflineBanner';

type ScreenState =
  | { status: 'checking' }
  | { status: 'connected'; health: HealthResponse }
  | { status: 'disconnected'; message: string };

export default function HomeScreen() {
  const { state: authState } = useAuth();
  const dbInit = useDbInit();
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'checking' });
  const [dbStats, setDbStats] = useState<string>('');
  const [dbTestLog, setDbTestLog] = useState<string[]>([]);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTestSuccess, setDbTestSuccess] = useState<boolean | null>(null);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({ RECEIVED: 0, PROCESSING: 0, READY: 0 });
  const [paymentSummary, setPaymentSummary] = useState<{ collectedToday: number; outstandingBalance: number } | null>(null);

  const checkConnection = useCallback(async () => {
    setScreenState({ status: 'checking' });
    try {
      const health = await api.getHealth();
      setScreenState({ status: 'connected', health });
    } catch (error) {
      setScreenState({
        status: 'disconnected',
        message: error instanceof Error ? error.message : 'Unable to connect to Clean server.',
      });
    }
  }, []);

  const refreshDbStats = useCallback(async () => {
    const stats = await getLocalDbStats();
    if (stats) {
      setDbStats(
        `shops:${stats.shops} customers:${stats.customers} services:${stats.services} orders:${stats.orders} pending:${stats.pending}`
      );
    } else {
      setDbStats('Not ready');
    }
    // also refresh order counts for dashboard (offline)
    if (authState.status === 'authenticated') {
      try {
        const c = await getOrderCounts(authState.session.shop.id);
        setOrderCounts(c);
      } catch {}
      try {
        const p = await getPaymentSummary(authState.session.shop.id);
        setPaymentSummary({ collectedToday: p.collectedToday, outstandingBalance: p.outstandingBalance });
      } catch {}
    }
  }, [authState]);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (dbInit.status === 'ready') {
      void refreshDbStats();
    }
  }, [dbInit, refreshDbStats]);

  useFocusEffect(
    useCallback(() => {
      if (dbInit.status === 'ready') void refreshDbStats();
    }, [dbInit.status, refreshDbStats])
  );

  const runDbTest = useCallback(async () => {
    setDbTesting(true);
    setDbTestLog(['Running local DB verification...']);
    setDbTestSuccess(null);
    const result = await runDevDbTest();
    setDbTestLog(result.steps);
    setDbTestSuccess(result.success);
    setDbTesting(false);
    void refreshDbStats();
  }, [refreshDbStats]);

  // Auth gate — redirect to login if unauthenticated, allow offline cached session
  useEffect(() => {
    if (authState.status === 'unauthenticated') {
      router.replace('/login' as any);
    }
  }, [authState]);

  if (authState.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.scroll, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#3157d5" />
          <Text style={styles.statusText}> Restoring session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authState.status === 'unauthenticated') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.scroll, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#3157d5" />
          <Text style={styles.statusText}> Redirecting to login...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const session = authState.session;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Clean</Text>
            <Text style={styles.subtitle}>Offline-First Laundry Management</Text>
          </View>
          <Pressable onPress={() => router.push('/settings' as any)} style={styles.settingsButton}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </Pressable>
        </View>

        {screenState.status === 'disconnected' ? <OfflineBanner status="offline" /> : screenState.status === 'checking' ? <OfflineBanner status="pending" /> : null}

        {/* Auth Banner */}
        <View style={styles.authCard}>
          <Text style={styles.authShop}>{session.shop.name}</Text>
          <Text style={styles.authUser}>
            {session.user.name} • {session.user.email}
          </Text>
          <Text style={styles.authHint}>Cached session works offline (exp 7d)</Text>
        </View>

        {/* Dashboard Counts (offline) */}
        <View style={styles.countsCard}>
          <Text style={styles.countsTitle}>Today's Laundry</Text>
          <View style={styles.countsRow}>
            <View style={styles.countBox}>
              <Text style={styles.countNumber}>{orderCounts.RECEIVED ?? 0}</Text>
              <Text style={styles.countLabel}>Received</Text>
            </View>
            <View style={styles.countBox}>
              <Text style={styles.countNumber}>{orderCounts.PROCESSING ?? 0}</Text>
              <Text style={styles.countLabel}>Processing</Text>
            </View>
            <View style={styles.countBox}>
              <Text style={[styles.countNumber, (orderCounts.READY ?? 0) >= 2 && { color: '#d97706' }]}>{orderCounts.READY ?? 0}</Text>
              <Text style={styles.countLabel}>Ready</Text>
            </View>
          </View>
          {paymentSummary && (
            <Pressable onPress={() => router.push('/reports' as any)} style={styles.financeRow}>
              <View style={styles.financeBox}>
                <Text style={styles.financeLabel}>Collected Today</Text>
                <Text style={styles.financeValue}>₱{(paymentSummary.collectedToday / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.financeBox}>
                <Text style={styles.financeLabel}>Outstanding</Text>
                <Text style={[styles.financeValue, { color: '#b45309' }]}>₱{(paymentSummary.outstandingBalance / 100).toFixed(2)}</Text>
              </View>
            </Pressable>
          )}
          {paymentSummary && <Text style={styles.tapHint}>Tap Collected/Outstanding → Reports</Text>}
          <Text style={styles.countsHint}>Shop-scoped, local SQLite, works offline</Text>
        </View>

        {/* Navigation */}
        <Pressable onPress={() => router.push('/receive' as any)} style={styles.receiveButton}>
          <Text style={styles.receiveText}>＋ Receive Laundry</Text>
          <Text style={styles.receiveHint}>Customer → Service → Price → Create</Text>
        </Pressable>
        <View style={styles.navCard}>
          <Text style={styles.navTitle}>Manage</Text>
          <View style={styles.navRow}>
            <Pressable onPress={() => router.push('/orders' as any)} style={styles.navButton}>
              <Text style={styles.navButtonText}>Orders</Text>
              <Text style={styles.navHint}>Received laundry</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/customers' as any)} style={styles.navButton}>
              <Text style={styles.navButtonText}>Customers</Text>
              <Text style={styles.navHint}>Search, add, edit</Text>
            </Pressable>
          </View>
          <View style={[styles.navRow, { marginTop: 10 }]}>
            <Pressable onPress={() => router.push('/services' as any)} style={styles.navButton}>
              <Text style={styles.navButtonText}>Services & Rates</Text>
              <Text style={styles.navHint}>Per kg / piece / fixed</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/payments' as any)} style={styles.navButton}>
              <Text style={styles.navButtonText}>Payments</Text>
              <Text style={styles.navHint}>Collections & balances</Text>
            </Pressable>
          </View>
          <View style={[styles.navRow, { marginTop: 10 }]}>
            <Pressable onPress={() => router.push('/reports' as any)} style={styles.navButton}>
              <Text style={styles.navButtonText}>Reports</Text>
              <Text style={styles.navHint}>Analytics & trends</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/settings' as any)} style={styles.navButton}>
              <Text style={styles.navButtonText}>Settings</Text>
              <Text style={styles.navHint}>Profile & logout</Text>
            </Pressable>
          </View>
        </View>

        {/* Local DB Card — must work without backend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Local Database (expo-sqlite)</Text>
          {dbInit.status === 'loading' && (
            <View style={styles.row}>
              <ActivityIndicator size="small" color="#3157d5" />
              <Text style={styles.statusText}> Initializing clean.db ...</Text>
            </View>
          )}
          {dbInit.status === 'error' && (
            <>
              <Text style={styles.errorTitle}>DB Error</Text>
              <Text style={styles.errorMessage}>{dbInit.message}</Text>
            </>
          )}
          {dbInit.status === 'ready' && (
            <>
              <StatusRow label="Status" value="Ready" />
              <StatusRow label="File" value="clean.db (WAL)" />
              <StatusRow label="Stats" value={dbStats || 'loading...'} />
              <Text style={styles.note}>
                Works offline. All laundry operations use this DB first. No internet required.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={runDbTest}
                disabled={dbTesting}
                style={[styles.button, dbTesting && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>{dbTesting ? 'Testing...' : 'Run Local DB Test'}</Text>
              </Pressable>
              {dbTestLog.length > 0 && (
                <View style={styles.logBox}>
                  <Text style={[styles.logTitle, dbTestSuccess === true && styles.successTitle, dbTestSuccess === false && styles.errorTitle]}>
                    {dbTestSuccess === null ? 'Test Log' : dbTestSuccess ? '✅ Test Passed' : '❌ Test Failed'}
                  </Text>
                  {dbTestLog.map((line, i) => (
                    <Text key={i} style={styles.logLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* API Health Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server (REST API)</Text>
          <Text style={styles.note}>Backend is backup only. Local DB works even when server is disconnected.</Text>
          {screenState.status === 'checking' && <CheckingState />}
          {screenState.status === 'connected' && <ConnectedState health={screenState.health} />}
          {screenState.status === 'disconnected' && (
            <DisconnectedState message={screenState.message} onRetry={checkConnection} />
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Next: Receive Laundry → Customer → Service → Weight → Price → Payment → RECEIVED → PROCESSING → READY → COMPLETED → History → Sync</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckingState() {
  return (
    <View style={styles.inlineCard}>
      <ActivityIndicator size="small" color="#3157d5" />
      <Text style={styles.statusText}> Checking /api/v1/health ...</Text>
    </View>
  );
}

function ConnectedState({ health }: { health: HealthResponse }) {
  return (
    <View style={styles.inlineCard}>
      <Text style={styles.successTitleSmall}>Connected</Text>
      <StatusRow label="Server" value={health.data.api} />
      <StatusRow label="Database" value={health.data.database} />
    </View>
  );
}

function DisconnectedState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.inlineCard}>
      <Text style={styles.errorTitleSmall}>Server: Disconnected (OK for offline)</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.buttonSecondary}>
        <Text style={styles.buttonSecondaryText}>Retry Connection</Text>
      </Pressable>
    </View>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { color: '#172554', fontSize: 34, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 6, textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  settingsButton: { backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  settingsButtonText: { color: '#1e293b', fontSize: 13, fontWeight: '700' },
  authCard: { backgroundColor: '#172554', borderRadius: 14, padding: 14, marginTop: 18 },
  authShop: { color: '#fff', fontSize: 16, fontWeight: '800' },
  authUser: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  authHint: { color: '#94a3b8', fontSize: 10, marginTop: 6, fontStyle: 'italic' },
  receiveButton: { backgroundColor: '#3157d5', borderRadius: 16, padding: 18, marginTop: 18, alignItems: 'center', elevation: 2, shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 12 },
  receiveText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  receiveHint: { color: '#cbd5e1', fontSize: 11, marginTop: 4 },
  countsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 14, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  countsTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  countsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  countBox: { alignItems: 'center', flex: 1 },
  countNumber: { color: '#172554', fontSize: 22, fontWeight: '800' },
  countLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  countsHint: { color: '#94a3b8', fontSize: 10, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  tapHint: { color: '#3157d5', fontSize: 10, marginTop: 6, textAlign: 'center', fontWeight: '600' },
  financeRow: { flexDirection: 'row', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  financeBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  financeLabel: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  financeValue: { color: '#172554', fontSize: 14, fontWeight: '800', marginTop: 4 },
  navCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 14, elevation: 1, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10 },
  navTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  navRow: { flexDirection: 'row', gap: 10 },
  navButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center' },
  navButtonText: { color: '#172554', fontSize: 14, fontWeight: '800' },
  navHint: { color: '#64748b', fontSize: 10, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 2,
    marginTop: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardTitle: { color: '#1e293b', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  inlineCard: { marginTop: 8 },
  statusText: { color: '#334155', fontSize: 14, textAlign: 'left' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  successTitleSmall: { color: '#15803d', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  errorTitleSmall: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  errorTitle: { color: '#b91c1c', fontSize: 16, fontWeight: '700' },
  errorMessage: { color: '#475569', fontSize: 13, lineHeight: 18, marginTop: 8 },
  note: { color: '#64748b', fontSize: 12, lineHeight: 16, marginTop: 10, fontStyle: 'italic' },
  statusRow: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: { color: '#475569', fontSize: 13, fontWeight: '600', flex: 1 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 16, padding: 14 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  buttonSecondary: { backgroundColor: '#e2e8f0', borderRadius: 8, marginTop: 12, padding: 12 },
  buttonSecondaryText: { color: '#1e293b', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  logBox: { backgroundColor: '#0f172a', borderRadius: 10, marginTop: 16, padding: 14 },
  logTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  successTitle: { color: '#4ade80' },
  logLine: { color: '#cbd5e1', fontSize: 11, lineHeight: 15, fontFamily: 'monospace' },
  footer: { marginTop: 24, padding: 12 },
  footerText: { color: '#94a3b8', fontSize: 11, textAlign: 'center', lineHeight: 15 },
});
