import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { useSyncOnForeground } from '@/sync/useSyncOnForeground';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function SyncWrapper() {
  useSyncOnForeground();
  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SyncWrapper />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
