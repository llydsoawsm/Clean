import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, ScrollView, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';

export default function LoginScreen() {
  const { login, state } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to home (but AuthProvider may still be loading)
  // Avoid loop: only show login when not authenticated

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/' as any);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.message.toLowerCase().includes('unable to connect') || e.message.toLowerCase().includes('network')) {
          setError('Offline: login requires internet for first-time authentication. Cached session will be used if previously logged in.');
        } else {
          setError(e.message);
        }
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Image source={require('../assets/clean-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Clean</Text>
        <Text style={styles.subtitle}>Laundry Shop Login</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="owner@shop.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={handleLogin}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
          </Pressable>

          <Text style={styles.note}>First login requires internet. After that, you can open Clean offline.</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>No account yet? </Text>
            <Link href={'/register' as any} style={styles.link}>
              Create shop
            </Link>
          </View>

          {state.status === 'unauthenticated' && state.reason && (
            <Text style={styles.hint}>{state.reason}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  container: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 80, height: 80, borderRadius: 16 },
  title: { color: '#172554', fontSize: 36, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12, lineHeight: 18 },
  button: { backgroundColor: '#3157d5', borderRadius: 10, marginTop: 18, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { color: '#64748b', fontSize: 11, marginTop: 12, textAlign: 'center', lineHeight: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  footerText: { color: '#475569', fontSize: 13 },
  link: { color: '#3157d5', fontSize: 13, fontWeight: '700' },
  hint: { color: '#64748b', fontSize: 11, marginTop: 10, textAlign: 'center' },
});
