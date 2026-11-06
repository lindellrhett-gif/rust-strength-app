import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

export interface ChipOption<K extends string | number> {
  key: K;
  label: string;
}

/** A row of choices, one selected: units, meals. Wraps onto more lines as needed. */
export function Chips<K extends string | number>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  options: readonly ChipOption<K>[];
  selected: K | null;
  onSelect: (key: K) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.key === selected;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onSelect(o.key)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            hitSlop={4}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.onPrimary },
});
