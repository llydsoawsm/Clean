import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrderStatus, PaymentStatus } from '@/db/types';
import { ORDER_STATUS_META, PAYMENT_STATUS_META, theme } from '@/theme';

type StatusType = 'order' | 'payment' | 'sync' | 'service';

const syncStyles: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'Pending', bg: theme.colors.readyBg, fg: theme.colors.ready },
  SYNCING: { label: 'Syncing', bg: theme.colors.brandSoft, fg: theme.colors.brand },
  SYNCED: { label: 'Synced', bg: theme.colors.claimedBg, fg: theme.colors.claimed },
  FAILED: { label: 'Retry', bg: theme.colors.dangerBg, fg: theme.colors.danger },
  OFFLINE: { label: 'Offline', bg: theme.colors.surfaceAlt, fg: theme.colors.inkSecondary },
};

const serviceStyles: Record<string, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'Active', bg: theme.colors.claimedBg, fg: theme.colors.claimed },
  INACTIVE: { label: 'Paused', bg: theme.colors.surfaceAlt, fg: theme.colors.inkSecondary },
};

function resolveBadge(type: StatusType, value: string): { label: string; bg: string; fg: string } {
  const key = value.toUpperCase();
  if (type === 'order' && key in ORDER_STATUS_META) {
    const meta = ORDER_STATUS_META[key as OrderStatus];
    return { label: meta.label, bg: meta.bg, fg: meta.color };
  }
  if (type === 'payment' && key in PAYMENT_STATUS_META) {
    const meta = PAYMENT_STATUS_META[key as PaymentStatus];
    return { label: meta.label, bg: meta.bg, fg: meta.color };
  }
  if (type === 'sync') {
    return syncStyles[key] ?? { label: value, bg: theme.colors.surfaceAlt, fg: theme.colors.inkSecondary };
  }
  return serviceStyles[key] ?? { label: value, bg: theme.colors.surfaceAlt, fg: theme.colors.inkSecondary };
}

export function StatusBadge({ type = 'order', value }: { type?: StatusType; value: string }) {
  const c = resolveBadge(type, value);
  return (
    <View accessibilityLabel={`${type} status ${c.label}`} style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.text, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export function RushBadge() {
  return (
    <View style={styles.rushPill}>
      <MaterialCommunityIcons name="lightning-bolt" size={12} color={theme.colors.rush} />
      <Text style={styles.rushText}>Rush</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
  rushPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.rushBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rushText: {
    color: theme.colors.rush,
    fontSize: 11,
    fontWeight: '700',
  },
});
