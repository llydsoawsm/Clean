import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, type MciIconName } from '@/theme';

type BannerStatus = 'online' | 'offline' | 'syncing' | 'pending' | 'synced' | 'failed';

const BANNER_META: Record<BannerStatus, { text: string; bg: string; fg: string; icon: MciIconName }> = {
  online: { text: 'Online', bg: theme.colors.claimedBg, fg: theme.colors.claimed, icon: 'cloud-check-outline' },
  offline: { text: 'Offline', bg: theme.colors.surfaceAlt, fg: theme.colors.inkSecondary, icon: 'cloud-off-outline' },
  syncing: { text: 'Syncing...', bg: theme.colors.brandSoft, fg: theme.colors.brand, icon: 'sync' },
  pending: { text: 'Unsynced changes', bg: theme.colors.readyBg, fg: theme.colors.ready, icon: 'clock-outline' },
  synced: { text: 'Synced', bg: theme.colors.claimedBg, fg: theme.colors.claimed, icon: 'cloud-check-outline' },
  failed: { text: 'Sync paused', bg: theme.colors.dangerBg, fg: theme.colors.danger, icon: 'alert-circle-outline' },
};

export function OfflineBanner({ status }: { status: BannerStatus }) {
  const c = BANNER_META[status] ?? BANNER_META.offline;
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <MaterialCommunityIcons name={c.icon} size={14} color={c.fg} />
      <Text style={[styles.text, { color: c.fg }]}>{c.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    marginBottom: theme.spacing.md,
    alignSelf: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
