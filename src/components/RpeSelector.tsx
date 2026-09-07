import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, rpeColor } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

const DESCRIPTIONS: Record<number, string> = {
  6: '4+ reps left',
  7: '3 reps left',
  8: '2 reps left',
  9: '1 rep left',
  10: 'nothing left — true failure',
};

interface RpeSelectorProps {
  value: number | null;
  onChange: (rpe: number) => void;
}

export function RpeSelector({ value, onChange }: RpeSelectorProps) {
  const desc = value == null ? 'How hard was that set?' : DESCRIPTIONS[Math.floor(value)] ?? '';
  return (
    <View style={styles.wrap}>
      <Text style={text.label}>RPE — RATE OF PERCEIVED EXERTION</Text>
      <View style={styles.grid}>
        {OPTIONS.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt)}
              style={[
                styles.chip,
                selected && { backgroundColor: rpeColor(opt), borderColor: rpeColor(opt) },
              ]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.desc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chipTextSelected: { color: colors.onPrimary },
  desc: { color: colors.textMuted, fontSize: 13, minHeight: 18 },
});
