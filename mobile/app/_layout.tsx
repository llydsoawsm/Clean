import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useSyncOnForeground } from '@/sync/useSyncOnForeground';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PersistentBottomTabBar } from '@/components/BottomTabBar';
import { theme } from '@/theme';

function SyncWrapper() {
  useSyncOnForeground();
  return null;
}

function AuthGate() {
  const { state } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === 'loading') return;
    const isAuthScreen = pathname === '/login' || pathname === '/register';
    if (state.status === 'unauthenticated' && !isAuthScreen) {
      router.replace('/login' as any);
    } else if (state.status === 'authenticated' && isAuthScreen) {
      router.replace('/' as any);
    }
  }, [state.status, pathname]);

  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <AuthGate />
            <SyncWrapper />
            <StatusBar style="dark" />
            <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.bg },
                }}
              >
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="orders" options={{ animation: 'none' }} />
                <Stack.Screen name="customers" options={{ animation: 'none' }} />
                <Stack.Screen name="settings" options={{ animation: 'none' }} />
                <Stack.Screen name="login" options={{ animation: 'fade' }} />
                <Stack.Screen name="register" options={{ animation: 'fade' }} />
              </Stack>
              <PersistentBottomTabBar />
            </View>
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
