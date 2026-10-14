import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    router.replace('/' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandIconBox}>
            <Ionicons name="water" size={28} color="#1d4ed8" />
          </View>
          <Text style={styles.brandTitle}>Clean</Text>
          <Text style={styles.brandSubtitle}>Laundry Management</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="owner@cleanlaundry.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable onPress={handleLogin} style={styles.button}>
            <Text style={styles.buttonText}>Log In</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to Clean? </Text>
            <Link href={'/register' as any} style={styles.linkText}>
              Create Shop
            </Link>
          </View>
        </View>
      </ScrollView>
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
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { color: '#64748b', fontSize: 13 },
  linkText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
});
