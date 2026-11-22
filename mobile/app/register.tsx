import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (shopName.trim().length < 2) {
      setError('Shop name must be at least 2 characters.');
      return;
    }
    if (ownerName.trim().length < 2) {
      setError('Owner name must be at least 2 characters.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await register({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: cleanEmail,
        password,
      });
      router.replace('/' as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandIconBox}>
              <Ionicons name="water" size={28} color="#1d4ed8" />
            </View>
            <Text style={styles.brandTitle}>Create Shop</Text>
            <Text style={styles.brandSubtitle}>Clean Laundry Management</Text>
          </View>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Shop Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Clean Laundry Co."
              placeholderTextColor="#94a3b8"
              value={shopName}
              onChangeText={setShopName}
              editable={!submitting}
            />

            <Text style={styles.label}>Owner Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Juan Dela Cruz"
              placeholderTextColor="#94a3b8"
              value={ownerName}
              onChangeText={setOwnerName}
              editable={!submitting}
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="owner@cleanlaundry.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
            />

            <Text style={styles.label}>Password (min. 8 characters)</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!submitting}
              onSubmitEditing={handleRegister}
            />

            <Pressable
              onPress={handleRegister}
              disabled={submitting}
              style={[styles.button, submitting && styles.buttonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Register Shop</Text>
              )}
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already registered? </Text>
              <Link href={'/login' as any} style={styles.linkText}>
                Log In
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  header: { alignItems: 'center', marginBottom: 28 },
  brandIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: { color: '#0f172a', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  brandSubtitle: { color: '#64748b', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: '#b91c1c', fontSize: 12, fontWeight: '500' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { color: '#64748b', fontSize: 13 },
  linkText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
});
