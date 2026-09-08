import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);
    if (!shopName.trim() || !ownerName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ shopName, ownerName, email, password });
      router.replace('/' as any);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.statusCode === 409) setError('Email already registered. Try logging in.');
        else setError(e.message);
      } else if (e instanceof Error) setError(e.message);
      else setError('Registration failed');
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
        <Text style={styles.title}>Create Shop</Text>
        <Text style={styles.subtitle}>One account per laundry shop (owner)</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Shop Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Clean Laundry"
            value={shopName}
            onChangeText={setShopName}
            editable={!loading}
          />

          <Text style={styles.label}>Owner Name</Text>
          <TextInput style={styles.input} placeholder="Juan Dela Cruz" value={ownerName} onChangeText={setOwnerName} editable={!loading} />

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

          <Text style={styles.label}>Password (min 8)</Text>
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
            onPress={handleRegister}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href={'/login' as any} style={styles.link}>
              Log in
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6fb' },
  container: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 72, height: 72, borderRadius: 14 },
  title: { color: '#172554', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  footerText: { color: '#475569', fontSize: 13 },
  link: { color: '#3157d5', fontSize: 13, fontWeight: '700' },
});
