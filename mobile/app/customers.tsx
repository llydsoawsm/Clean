import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { searchCustomers } from '@/db/repositories/customers';
import { runSync } from '@/sync/engine';
import type { CustomerRow } from '@/db/types';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { TabHeader } from '@/components/ScreenHeader';
import { useBottomNavPadding } from '@/components/BottomTabBar';
import { HeaderIconButton, SearchBar } from '@/components/ui';
import { avatarTone, getInitials, theme } from '@/theme';

export default function CustomersScreen() {
  const session = useAuthSession();
  const bottomNavPadding = useBottomNavPadding();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (searchText: string) => {
      if (!session) return;
      try {
        await initDatabase();
        const rows = await searchCustomers(searchText, session.shop.id);
        setCustomers(rows);
      } catch (e) {
        console.warn('[Customers] load error:', e);
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  useFocusEffect(
    useCallback(() => {
      void load(query);
    }, [load, query])
  );

  useEffect(() => {
    void load(query);
  }, [load, query]);

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      await runSync(session.shop.id, session.token).catch(() => {});
      await load(query);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TabHeader
        title="Customers"
        count={customers.length}
        right={
          <HeaderIconButton
            icon="plus"
            onPress={() => router.push('/customer-add' as any)}
            accessibilityLabel="Add customer"
          />
        }
      />

      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or phone"
          surface="card"
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomNavPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand}
              colors={[theme.colors.brand]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title="No customers"
              hint={query.trim() ? 'No match found' : 'Add your first customer'}
              actionLabel={!query.trim() ? 'Add Customer' : undefined}
              onAction={!query.trim() ? () => router.push('/customer-add' as any) : undefined}
            />
          }
          renderItem={({ item }) => {
            const tone = avatarTone(item.name);
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/customer-detail' as any, params: { id: item.id } })}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.avatarText, { color: tone.fg }]}>{getInitials(item.name)}</Text>
                </View>

                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.contact_number}
                    {item.transaction_count > 0
                      ? ` · ${item.transaction_count} ${item.transaction_count === 1 ? 'order' : 'orders'}`
                      : ''}
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push({ pathname: '/receive' as any, params: { customerId: item.id } })}
                  style={({ pressed }) => [styles.quickOrderBtn, pressed && styles.pressed]}
                  hitSlop={6}
                  accessibilityLabel={`New drop-off for ${item.name}`}
                >
                  <MaterialCommunityIcons name="plus" size={19} color={theme.colors.brand} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  searchWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.layout.listCardPadding,
    marginBottom: theme.layout.listGap,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  quickOrderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
