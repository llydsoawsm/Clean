import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, typography, type MciIconName } from '@/theme';

export function useScreenBottomPadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.lg;
}

export function Card({
  children,
  style,
  noPadding = false,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  variant?: 'default' | 'highlight';
}) {
  return (
    <View
      style={[
        styles.card,
        noPadding && styles.cardNoPadding,
        variant === 'highlight' && styles.cardHighlight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {right ?? null}
    </View>
  );
}

export function Divider({ spacing = 10 }: { spacing?: number }) {
  return <View style={[styles.divider, { marginVertical: spacing }]} />;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'soft' | 'dangerSoft';
  size?: 'lg' | 'md';
  icon?: MciIconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const isDisabled = Boolean(disabled || loading);
  const fgColor =
    variant === 'primary'
      ? theme.colors.white
      : variant === 'soft'
        ? theme.colors.brand
        : theme.colors.danger;
  const iconSize = size === 'lg' ? 18 : 17;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.btnBase,
        size === 'lg' ? styles.btnLg : styles.btnMd,
        variant === 'primary'
          ? styles.btnPrimary
          : variant === 'soft'
            ? styles.btnSoft
            : styles.btnDangerSoft,
        pressed && !isDisabled && (variant === 'primary' ? styles.btnPrimaryPressed : styles.pressed),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fgColor} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={iconSize} color={fgColor} /> : null}
          <Text
            style={[
              size === 'lg' ? styles.btnTextLg : styles.btnTextMd,
              { color: fgColor },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'primary',
  iconSize = 20,
}: {
  icon: MciIconName;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'primary' | 'surface';
  iconSize?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.headerIconBtn,
        variant === 'primary' ? styles.headerIconPrimary : styles.headerIconSurface,
        pressed && (variant === 'primary' ? styles.btnPrimaryPressed : styles.pressed),
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={iconSize}
        color={variant === 'primary' ? theme.colors.white : theme.colors.ink}
      />
    </Pressable>
  );
}

export function FormField({
  label,
  first = false,
  error,
  children,
}: {
  label: string;
  first?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={!first && styles.fieldSpacing}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function FormInput({
  containerStyle,
  rightAccessory,
  multiline,
  style,
  placeholderTextColor,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  rightAccessory?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: NativeSyntheticEvent<TargetedEvent>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: NativeSyntheticEvent<TargetedEvent>) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View
      style={[
        styles.inputWrap,
        multiline && styles.inputWrapMultiline,
        focused && styles.inputWrapFocused,
        containerStyle,
      ]}
    >
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={placeholderTextColor ?? theme.colors.inkMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[styles.inputInner, multiline && styles.inputInnerMultiline, style]}
      />
      {rightAccessory ?? null}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  surface = 'card',
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  surface?: 'card' | 'inset';
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.searchBox,
        surface === 'inset' ? styles.searchBoxInset : styles.searchBoxCard,
        focused && styles.inputWrapFocused,
        style,
      ]}
    >
      <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.inkMuted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.searchInput}
        autoCapitalize="none"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <MaterialCommunityIcons name="close" size={18} color={theme.colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterChip({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmentTray, style]}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => [
              styles.segmentBtn,
              active && styles.segmentBtnActive,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OptionChips<T extends string>({
  options,
  value,
  onChange,
  layout = 'equal',
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  layout?: 'equal' | 'wrap';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        layout === 'wrap' ? styles.optionWrapRow : styles.optionEqualRow,
        style,
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => [
              styles.optionChip,
              layout === 'wrap' ? styles.optionChipWrap : styles.optionChipEqual,
              active && styles.optionChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function KeyValueRow({
  label,
  value,
  emphasis = 'normal',
  valueColor,
  divider = false,
  multiline = false,
  compact = false,
}: {
  label: string;
  value: string;
  emphasis?: 'normal' | 'bold' | 'total';
  valueColor?: string;
  divider?: boolean;
  multiline?: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.kvRow,
        compact ? styles.kvRowCompact : styles.kvRowRegular,
        multiline && styles.kvRowMultiline,
        divider && styles.kvDivider,
      ]}
    >
      <Text
        style={
          emphasis === 'normal' ? styles.kvLabelNormal : styles.kvLabelBold
        }
      >
        {label}
      </Text>
      <Text
        style={[
          emphasis === 'total'
            ? styles.kvValueTotal
            : emphasis === 'bold'
              ? styles.kvValueBold
              : styles.kvValueNormal,
          multiline && styles.kvValueMultiline,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardNoPadding: {
    padding: 0,
    overflow: 'hidden',
  },
  cardHighlight: {
    borderColor: theme.colors.readyBorder,
    backgroundColor: theme.colors.readySurface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionHeaderTitle: {
    ...typography.cardTitle,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
  },
  btnBase: {
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  btnLg: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  btnMd: {
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnPrimary: {
    backgroundColor: theme.colors.brand,
  },
  btnPrimaryPressed: {
    backgroundColor: theme.colors.brandDark,
  },
  btnSoft: {
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandBorder,
  },
  btnDangerSoft: {
    backgroundColor: theme.colors.dangerBg,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
  },
  btnTextLg: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnTextMd: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: theme.layout.pressedOpacity,
  },
  disabled: {
    opacity: theme.layout.disabledOpacity,
  },
  headerIconBtn: {
    width: theme.layout.iconBtnSize,
    height: theme.layout.iconBtnSize,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconPrimary: {
    backgroundColor: theme.colors.brand,
  },
  headerIconSurface: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fieldSpacing: {
    marginTop: theme.spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    marginBottom: 6,
  },
  fieldError: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceWarm,
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
    minHeight: 76,
  },
  inputWrapFocused: {
    borderColor: theme.colors.brand,
  },
  inputInner: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.ink,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  inputInnerMultiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchBoxCard: {
    backgroundColor: theme.colors.surface,
  },
  searchBoxInset: {
    backgroundColor: theme.colors.surfaceWarm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.ink,
    padding: 0,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  filterChipText: {
    color: theme.colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  segmentTray: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadow.card,
  },
  segmentText: {
    color: theme.colors.inkSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  optionEqualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 9,
    backgroundColor: theme.colors.surfaceWarm,
  },
  optionChipEqual: {
    flex: 1,
    alignItems: 'center',
  },
  optionChipWrap: {
    paddingHorizontal: 14,
  },
  optionChipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  optionText: {
    color: theme.colors.inkSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextActive: {
    color: theme.colors.white,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kvRowCompact: {
    paddingVertical: 5,
  },
  kvRowRegular: {
    paddingVertical: 9,
  },
  kvRowMultiline: {
    alignItems: 'flex-start',
  },
  kvDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  kvLabelNormal: {
    color: theme.colors.inkSecondary,
    fontSize: 13,
  },
  kvLabelBold: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  kvValueNormal: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  kvValueBold: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kvValueTotal: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  kvValueMultiline: {
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
});

