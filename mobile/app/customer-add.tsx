import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { createCustomer } from '@/db/repositories/customers';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { AppButton, Card, FormField, FormInput, useScreenBottomPadding } from '@/components/ui';
import { theme } from '@/theme';

export default function CustomerAddScreen() {
  const session = useAuthSession();
  const toast = useToast();
  const bottomPadding = useScreenBottomPadding();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!session) {
      Alert.alert('Sign In Required', 'Please sign in first.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Required', 'Enter customer name.');
      return;
    }
    if (!contact.trim()) {
      Alert.alert('Required', 'Enter a phone number.');
      return;
    }

    setSaving(true);
    try {
      await initDatabase();
      await createCustomer({
        shop_id: session.shop.id,
        name: name.trim(),
        contact_number: contact.trim(),
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      toast.show('Customer saved', 'success');
      router.back();
    } catch (e) {
      Alert.alert('Cannot Save', e instanceof Error ? e.message : 'Unable to save customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="New Customer" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <FormField label="Name" first>
              <FormInput
                placeholder="Full name"
                value={name}
                onChangeText={setName}
              />
            </FormField>

            <FormField label="Phone">
              <FormInput
                placeholder="0917-000-0000"
                value={contact}
                onChangeText={setContact}
                keyboardType="phone-pad"
              />
            </FormField>

            <FormField label="Address">
              <FormInput
                placeholder="Street or Barangay"
                value={address}
                onChangeText={setAddress}
              />
            </FormField>

            <FormField label="Notes">
              <FormInput
                placeholder="Fabric preferences, reminders..."
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </FormField>

            <AppButton
              variant="primary"
              label={saving ? 'Saving...' : 'Save'}
              onPress={handleSave}
              loading={saving}
              style={styles.submitBtn}
            />
          </Card>
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  submitBtn: {
    marginTop: theme.spacing.xl,
  },
});
