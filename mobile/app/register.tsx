import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { AppButton, Card, FormField, FormInput } from '@/components/ui';
import { theme, typography } from '@/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (shopName.trim().length < 2) {
      setError('Shop name must be at least 2 characters.');
      return;
    }
    if (ownerName.trim().length < 2) {
      setError('Your name must be at least 2 characters.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter a valid email address.');
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
      setError(e instanceof Error ? e.message : 'Unable to register. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandIconBox}>
              <MaterialCommunityIcons name="washing-machine" size={28} color={theme.colors.brand} />
            </View>
            <Text style={styles.brandTitle}>Set up shop</Text>
            <Text style={styles.brandSubtitle}>Start tracking laundry</Text>
          </View>

          <Card style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <FormField label="Shop name" first>
              <FormInput
                placeholder="e.g. Wash & Fold Laundry"
                value={shopName}
                onChangeText={setShopName}
                editable={!submitting}
              />
            </FormField>

            <FormField label="Your name">
              <FormInput
                placeholder="Juan Dela Cruz"
                value={ownerName}
                onChangeText={setOwnerName}
                editable={!submitting}
              />
            </FormField>

            <FormField label="Email">
              <FormInput
                placeholder="owner@shop.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!submitting}
              />
            </FormField>

            <FormField label="Password (8+ characters)">
              <FormInput
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
                onSubmitEditing={handleRegister}
                rightAccessory={
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.inkMuted}
                    />
                  </Pressable>
                }
              />
            </FormField>

            <AppButton
              variant="primary"
              label="Create Shop"
              onPress={handleRegister}
              loading={submitting}
              style={styles.submitBtn}
            />
          </Card>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Have an account? </Text>
            <Link href={'/login' as any} style={styles.linkText}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  brandIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  brandTitle: {
    ...typography.brandTitle,
  },
  brandSubtitle: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    padding: theme.spacing.xl,
    marginBottom: 0,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dangerBg,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitBtn: {
    marginTop: theme.spacing.xl,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
  },
  footerText: {
    color: theme.colors.inkSecondary,
    fontSize: 13,
  },
  linkText: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
});
