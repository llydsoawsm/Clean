import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type StatusType = 'order' | 'payment' | 'sync' | 'service';

const orderColors: Record<string, { bg: string; fg: string }> = {
  RECEIVED: { bg: '#dbeafe', fg: '#1e293b' },
  PROCESSING: { bg: '#fef9c3', fg: '#1e293b' },
  READY: { bg: '#ffedd5', fg: '#1e293b' },
  COMPLETED: { bg: '#dcfce7', fg: '#1e293b' },
};
const paymentColors: Record<string, { bg: string; fg: string }> = {
  UNPAID: { bg: '#fee2e2', fg: '#1e293b' },
  PARTIAL: { bg: '#fef9c3', fg: '#1e293b' },
  PAID: { bg: '#dcfce7', fg: '#1e293b' },
};
const syncColors: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef9c3', fg: '#1e293b' },
  SYNCING: { bg: '#dbeafe', fg: '#1e293b' },
  SYNCED: { bg: '#dcfce7', fg: '#1e293b' },
  FAILED: { bg: '#fee2e2', fg: '#1e293b' },
  OFFLINE: { bg: '#f1f5f9', fg: '#475569' },
};
const serviceColors: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: '#dcfce7', fg: '#1e293b' },
  INACTIVE: { bg: '#f1f5f9', fg: '#475569' },
};

function pick(type: StatusType, value: string) {
  const v = value.toUpperCase();
  if (type === 'order') return orderColors[v] ?? { bg: '#f1f5f9', fg: '#475569' };
  if (type === 'payment') return paymentColors[v] ?? { bg: '#f1f5f9', fg: '#475569' };
  if (type === 'sync') return syncColors[v] ?? { bg: '#f1f5f9', fg: '#475569' };
  return serviceColors[v] ?? { bg: '#f1f5f9', fg: '#475569' };
}

export function StatusBadge({ type = 'order', value }: { type?: StatusType; value: string }) {
  const c = pick(type, value);
  return (
    <View accessibilityLabel={`${type} status ${value}`} style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700' },
});
