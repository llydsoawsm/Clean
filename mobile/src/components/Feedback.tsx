import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#3157d5" />
      <Text style={styles.hint}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, hint, actionLabel, onAction }: { title: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Try Again</Text>
        </Pressable>
      ) : null}
      <Text style={styles.note}>Your local data is safe.</Text>
    </View>
  );
}

export function SkeletonCard() {
  return <View style={styles.skeleton} />;
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 20 },
  hint: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  emptyTitle: { color: '#1e293b', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  button: { backgroundColor: '#3157d5', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
  errorTitle: { color: '#b91c1c', fontSize: 16, fontWeight: '700' },
  errorMessage: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  secondaryButton: { backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  secondaryText: { color: '#1e293b', fontWeight: '600' },
  note: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  skeleton: { backgroundColor: '#e2e8f0', borderRadius: 12, height: 80, marginHorizontal: 16, marginTop: 12 },
});
