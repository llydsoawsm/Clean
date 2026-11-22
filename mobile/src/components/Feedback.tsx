import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, type MciIconName } from '@/theme';

export function LoadingState({ message }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.brand} />
      {message ? <Text style={styles.hint}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
  icon = 'basket-outline',
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: MciIconName;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={icon} size={24} color={theme.colors.inkMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.dangerBg }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color={theme.colors.danger} />
      </View>
      <Text style={styles.errorTitle}>Couldn’t load</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
    marginTop: theme.spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  hint: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 11,
    marginTop: theme.spacing.lg,
  },
  buttonPressed: {
    backgroundColor: theme.colors.brandDark,
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  pressed: { opacity: theme.layout.pressedOpacity },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  errorMessage: {
    color: theme.colors.inkSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: theme.spacing.md,
  },
  secondaryText: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  skeleton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    height: 76,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
});
