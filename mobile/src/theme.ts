/**
 * Clean Design Tokens — single source for spacing, colors, typography, radius.
 * Keeps Phase 10 polish consistent without redesigning working screens.
 */
export const theme = {
  colors: {
    primary: '#3157d5',
    primaryDark: '#172554',
    background: '#f4f6fb',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    textLight: '#94a3b8',
    success: '#16a34a',
    successBg: '#dcfce7',
    warning: '#d97706',
    warningBg: '#fffbeb',
    danger: '#dc2626',
    dangerBg: '#fee2e2',
    infoBg: '#dbeafe',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 20,
  },
  typography: {
    title: { fontSize: 28, fontWeight: '800' as const, color: '#172554' },
    subtitle: { fontSize: 13, color: '#64748b' },
    cardTitle: { fontSize: 14, fontWeight: '700' as const, color: '#1e293b' },
    label: { fontSize: 12, fontWeight: '600' as const, color: '#64748b' },
    value: { fontSize: 13, fontWeight: '500' as const, color: '#0f172a' },
  },
} as const;
