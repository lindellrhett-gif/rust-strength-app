import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** Small number tiles sharing one line, for the top of Profile and Progress. */
export function MiniStatRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function MiniStat({
  value,
  label,
  spoken,
  onPress,
}: {
  value: string;
  label: string;
  /** For VoiceOver, when "value label" alone wouldn't say what it means. */
  spoken?: string;
  onPress?: () => void;
}) {
  const accessibilityLabel = spoken ?? `${value} ${label}`;
  const body = (
    <>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {value}
      </Text>
      <Text style={text.caption} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.tile} accessible accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  value: { color: colors.text, fontSize: 20, fontWeight: '800' },
});
