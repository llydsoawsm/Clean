import type { TextStyle } from 'react-native';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrderStatus, PaymentStatus } from '@/db/types';

export type MciIconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Clean Design System — warm cotton-linen surfaces, wash-blue primary,
 * and neighborhood laundry ticket semantics.
 */
export const theme = {
  colors: {
    bg: '#F5F3EE',
    surface: '#FFFFFF',
    surfaceAlt: '#ECE9E1',
    surfaceWarm: '#FAF9F6',
    border: '#E5E0D6',
    divider: '#EFECE5',
    brand: '#0E6BA8',
    brandDark: '#0A5282',
    brandSoft: '#E6F2FA',
    brandBorder: '#C3E0F4',
    brandOverlay: 'rgba(255, 255, 255, 0.22)',
    brandOnMuted: 'rgba(255, 255, 255, 0.80)',
    ink: '#1A2430',
    inkSecondary: '#54616F',
    inkMuted: '#86929E',
    white: '#FFFFFF',
    received: '#0E6BA8',
    receivedBg: '#E6F2FA',
    washing: '#0D7A6F',
    washingBg: '#E0F5F2',
    ready: '#B45309',
    readyBg: '#FEF1DC',
    readyDot: '#D97706',
    readyBorder: '#F3C784',
    readySurface: '#FFFDF8',
    claimed: '#1F7A47',
    claimedBg: '#E4F4EA',
    danger: '#B83227',
    dangerBg: '#FDECEB',
    dangerBorder: '#F5C6C2',
    rush: '#B45309',
    rushBg: '#FEF1DC',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  layout: {
    pagePadding: 16,
    cardPadding: 16,
    listCardPadding: 14,
    cardGap: 12,
    listGap: 10,
    headerHeight: 54,
    iconBtnSize: 36,
    pressedOpacity: 0.78,
    disabledOpacity: 0.55,
  },
  shadow: {
    card: {
      shadowColor: '#1A2430',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    tabBar: {
      shadowColor: '#1A2430',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -2 },
      elevation: 8,
    },
  },
} as const;

export type TypographyKey =
  | 'brandTitle'
  | 'pageTitle'
  | 'screenTitle'
  | 'cardTitle'
  | 'rowTitle'
  | 'rowTitleSm'
  | 'body'
  | 'label'
  | 'caption'
  | 'metric'
  | 'numeric';

export const typography: Record<TypographyKey, TextStyle> = {
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.colors.ink,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.ink,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: theme.colors.ink,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  rowTitleSm: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.ink,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.inkSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.inkMuted,
  },
  metric: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  numeric: {
    fontVariant: ['tabular-nums'],
  },
};

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; shortLabel: string; icon: MciIconName; color: string; bg: string }
> = {
  RECEIVED: {
    label: 'Drop-off',
    shortLabel: 'Drop-off',
    icon: 'basket-outline',
    color: theme.colors.received,
    bg: theme.colors.receivedBg,
  },
  PROCESSING: {
    label: 'Washing',
    shortLabel: 'Washing',
    icon: 'washing-machine',
    color: theme.colors.washing,
    bg: theme.colors.washingBg,
  },
  READY: {
    label: 'Ready',
    shortLabel: 'Ready',
    icon: 'hanger',
    color: theme.colors.ready,
    bg: theme.colors.readyBg,
  },
  COMPLETED: {
    label: 'Claimed',
    shortLabel: 'Claimed',
    icon: 'check-circle-outline',
    color: theme.colors.claimed,
    bg: theme.colors.claimedBg,
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; color: string; bg: string }
> = {
  UNPAID: {
    label: 'Unpaid',
    color: theme.colors.danger,
    bg: theme.colors.dangerBg,
  },
  PARTIAL: {
    label: 'Partial',
    color: theme.colors.ready,
    bg: theme.colors.readyBg,
  },
  PAID: {
    label: 'Paid',
    color: theme.colors.claimed,
    bg: theme.colors.claimedBg,
  },
};

const AVATAR_TONES = [
  { bg: '#E6F2FA', fg: '#0E6BA8' },
  { bg: '#E0F5F2', fg: '#0D7A6F' },
  { bg: '#FEF1DC', fg: '#B45309' },
  { bg: '#E4F4EA', fg: '#1F7A47' },
  { bg: '#ECE9E1', fg: '#54616F' },
] as const;

export function avatarTone(seed: string): { bg: string; fg: string } {
  const str = (seed || 'C').trim();
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function shortTicket(orderNumber: string): string {
  const match = orderNumber.match(/^CLN-\d+-(\d+)$/i);
  if (match) return `#${match[1]}`;
  return orderNumber;
}
