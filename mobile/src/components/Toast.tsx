import React, { createContext, useCallback, useContext, useState, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: string; message: string; type: ToastType };

const ToastContext = createContext<{ show: (msg: string, type?: ToastType) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 2500) as unknown as number;
    timers.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={styles.container}>
        {toasts.map((t) => (
          <View key={t.id} style={[styles.toast, t.type === 'success' ? styles.success : t.type === 'error' ? styles.error : styles.info]}>
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
  container: { position: 'absolute', bottom: 30, left: 16, right: 16, alignItems: 'center', zIndex: 999 },
  toast: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginTop: 8, minWidth: 200, alignItems: 'center', shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  text: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  success: { backgroundColor: '#16a34a' },
  error: { backgroundColor: '#dc2626' },
  info: { backgroundColor: '#172554' },
});
