import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, typography } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        accessibilityLabel="Go back"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.ink} />
      </Pressable>

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightSlot}>{right ?? null}</View>
    </View>
  );
}

export function TabHeader({
  title,
  subtitle,
  count,
  right,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.tabLeft}>
        <View style={styles.tabTitleRow}>
          <Text style={styles.tabTitle} numberOfLines={1}>
            {title}
          </Text>
          {count !== undefined ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.tabSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: theme.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.bg,
  },
  backBtn: {
    width: theme.layout.iconBtnSize,
    height: theme.layout.iconBtnSize,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: theme.layout.pressedOpacity },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    ...typography.screenTitle,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 1,
  },
  rightSlot: {
    minWidth: theme.layout.iconBtnSize,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    minHeight: 56,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg,
  },
  tabLeft: {
    flex: 1,
  },
  tabTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabTitle: {
    ...typography.pageTitle,
    flexShrink: 1,
  },
  countPill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countText: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
});

