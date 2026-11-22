import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '@/context/AuthContext';
import { initDatabase } from '@/db/client';
import { listServices } from '@/db/repositories/services';
import { runSync } from '@/sync/engine';
import type { PricingType, ServiceRow } from '@/db/types';
import { formatPHP } from '@/utils/money';
import { EmptyState, LoadingState } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterChip, HeaderIconButton, useScreenBottomPadding } from '@/components/ui';
import { theme, type MciIconName } from '@/theme';

function priceLabel(row: ServiceRow): string {
  const base = formatPHP(row.unit_price_centavos);
  if (row.pricing_type === 'per_load') {
    const blockKg = row.weight_block_grams ? row.weight_block_grams / 1000 : 8;
    return `${base} / ${blockKg}kg`;
  }
  if (row.pricing_type === 'per_kg') return `${base}/kg`;
  if (row.pricing_type === 'per_piece') return `${base}/pc`;
  return `${base} fixed`;
}

function serviceIcon(type: PricingType): MciIconName {
  if (type === 'per_load') return 'washing-machine';
  if (type === 'per_kg') return 'scale';
  if (type === 'per_piece') return 'tshirt-crew-outline';
  return 'tag-outline';
}

export default function ServicesScreen() {
  const session = useAuthSession();
  const bottomPadding = useScreenBottomPadding();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      await initDatabase();
      const rows = await listServices(session.shop.id, true);
      setServices(rows);
    } catch (e) {
      console.warn('[Services] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      await runSync(session.shop.id, session.token).catch(() => {});
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const activeCount = services.filter((s) => s.is_active === 1).length;
  const displayed = showInactive ? services : services.filter((s) => s.is_active === 1);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Services"
        right={
          <HeaderIconButton
            icon="plus"
            onPress={() => router.push('/service-add' as any)}
            accessibilityLabel="Add service"
          />
        }
      />

      <View style={styles.filterRow}>
        <FilterChip
          label={`Active · ${activeCount}`}
          active={!showInactive}
          onPress={() => setShowInactive(false)}
        />
        <FilterChip
          label={`All · ${services.length}`}
          active={showInactive}
          onPress={() => setShowInactive(true)}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
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
              icon="tag-outline"
              title="No services"
              hint="Add laundry services and rates"
              actionLabel="Add Service"
              onAction={() => router.push('/service-add' as any)}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/service-detail' as any, params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.iconBox}>
                <MaterialCommunityIcons
                  name={serviceIcon(item.pricing_type)}
                  size={20}
                  color={theme.colors.brand}
                />
              </View>

              <View style={styles.main}>
                <View style={styles.topRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.price}>{priceLabel(item)}</Text>
                </View>

                <View style={styles.bottomRow}>
                  {item.description ? (
                    <Text style={styles.desc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {!item.is_active ? <StatusBadge type="service" value="INACTIVE" /> : null}
                </View>
              </View>
            </Pressable>
          )}
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  price: {
    color: theme.colors.brand,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    gap: 8,
  },
  desc: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    flex: 1,
  },
});
