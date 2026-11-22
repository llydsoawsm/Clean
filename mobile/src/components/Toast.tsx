import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, type MciIconName } from '@/theme';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: string; message: string; type: ToastType };

const ToastContext = createContext<{ show: (msg: string, type?: ToastType) => void } | null>(null);

const TOAST_ICON: Record<ToastType, MciIconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'information-outline',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const toastBottom = Math.max(insets.bottom, 10) + 86;

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 2400) as unknown as number;
    timers.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={[styles.container, { bottom: toastBottom }]}>
        {toasts.map((t) => (
          <View
            key={t.id}
            style={[
              styles.toast,
              t.type === 'success' ? styles.success : t.type === 'error' ? styles.error : styles.info,
            ]}
          >
            <MaterialCommunityIcons name={TOAST_ICON[t.type]} size={16} color={theme.colors.white} />
            <Text style={styles.text}>{t.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
    marginTop: 8,
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  text: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  success: { backgroundColor: theme.colors.claimed },
  error: { backgroundColor: theme.colors.danger },
  info: { backgroundColor: theme.colors.ink },
});
