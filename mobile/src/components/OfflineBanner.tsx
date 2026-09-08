import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function OfflineBanner({ status }: { status: 'online' | 'offline' | 'syncing' | 'pending' | 'synced' | 'failed' }) {
  const labels: Record<string, { text: string; bg: string; fg: string }> = {
    online: { text: 'Online', bg: '#dcfce7', fg: '#166534' },
    offline: { text: 'Offline • Working with local data', bg: '#f1f5f9', fg: '#475569' },
    syncing: { text: 'Syncing...', bg: '#dbeafe', fg: '#1e40af' },
    pending: { text: 'Pending changes • Will sync when online', bg: '#fef9c3', fg: '#92400e' },
    synced: { text: 'All data synced', bg: '#dcfce7', fg: '#166534' },
    failed: { text: 'Sync failed • Data still saved locally', bg: '#fee2e2', fg: '#991b1b' },
  };
  const c = labels[status] ?? labels.offline;
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{c.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  text: { fontSize: 12, fontWeight: '600' },
});
