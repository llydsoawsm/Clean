import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View, ScrollView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const session = {
    shop: {
      name: 'Clean Laundry',
      owner_name: 'Juan Dela Cruz',
      contact_number: '0917-123-4567',
      address: '124 Rizal Ave, Barangay 5',
    },
    user: {
      name: 'Juan Dela Cruz',
      email: 'owner@cleanlaundry.com',
    },
  };

  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      Alert.alert('Synchronized', 'All orders, services, and customers are up to date.');
    }, 700);
  };

  const handleLogout = () => {
    router.replace('/login' as any);
  };

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

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Sync Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Cloud Synchronization</Text>
            <View style={styles.statusPill}>
              <View style={styles.blueDot} />
              <Text style={styles.statusText}>Connected</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Local database is synchronized with the server.</Text>

          <Pressable onPress={handleSync} disabled={syncing} style={styles.syncBtn}>
            <Ionicons name="sync-outline" size={16} color="#ffffff" />
            <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
          </Pressable>
        </View>

        {/* Shop Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop Details</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Shop Name</Text>
            <Text style={styles.rowValue}>{session.shop.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Owner</Text>
            <Text style={styles.rowValue}>{session.shop.owner_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Contact</Text>
            <Text style={styles.rowValue}>{session.shop.contact_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Address</Text>
            <Text style={styles.rowValue}>{session.shop.address}</Text>
          </View>
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
              <Text style={styles.appVer}>Version 0.1.0</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
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
  cardDesc: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  blueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1d4ed8' },
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
  syncBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
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
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
