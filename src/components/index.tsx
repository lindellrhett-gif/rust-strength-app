import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export { Screen } from './Screen';
export { Button } from './Button';
export { Card } from './Card';
export { Field } from './Field';
export { NumberStepper } from './NumberStepper';
export { RpeSelector } from './RpeSelector';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={text.bodyMuted}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={text.heading}>{title}</Text>
      {message ? <Text style={[text.bodyMuted, styles.msg]}>{message}</Text> : null}
    </View>
  );
}

export function Pill({ label, tint }: { label: string; tint?: string }) {
  return (
    <View style={[styles.pill, tint ? { borderColor: tint } : null]}>
      <Text style={[styles.pillText, tint ? { color: tint } : null]}>{label}</Text>
    </View>
  );
}

export function StatTile({
  value,
  label,
  icon,
  suffix,
  valueColor,
  children,
  onPress,
  accessibilityLabel,
}: {
  value: string;
  label: string;
  /** Drawn before the number, like the streak's flame. */
  icon?: ReactNode;
  /** Smaller text after the number: " / 10k". */
  suffix?: string;
  valueColor?: string;
  /** Between the number and the label, like a progress bar. */
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      <View style={styles.tileValue}>
        {icon}
        <Text style={[text.stat, valueColor ? { color: valueColor } : null]}>
          {value}
          {suffix ? <Text style={styles.tileSuffix}>{suffix}</Text> : null}
        </Text>
      </View>
      {children}
      <Text style={text.caption}>{label}</Text>
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.tile} accessible={accessibilityLabel != null} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  msg: { textAlign: 'center' },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tilePressed: { backgroundColor: colors.surfaceRaised },
  tileValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tileSuffix: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
