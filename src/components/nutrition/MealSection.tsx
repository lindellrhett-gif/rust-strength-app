import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import type { DiaryMeal } from '@/domain/nutrition/diary';
import { formatEnergy } from '@/domain/nutrition/diary';
import type { DiaryEntry } from '@/domain/nutrition/entries';
import { formatAmount } from '@/domain/nutrition/foods';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** One meal in the diary: its foods, its total, and a way to add to it. */
export function MealSection({
  meal,
  unit,
  onPressEntry,
  onAdd,
  copyLabel,
  onCopy,
  onSaveMeal,
}: {
  meal: DiaryMeal;
  unit: 'kcal' | 'kj';
  onPressEntry: (entry: DiaryEntry) => void;
  onAdd: () => void;
  /** Shown on an empty meal when the same meal yesterday had food. */
  copyLabel?: string;
  onCopy?: () => void;
  /** Save this meal's foods to log again in one tap. */
  onSaveMeal?: () => void;
}) {
  return (
    <Card>
      <View style={styles.header}>
        <Text style={text.heading} numberOfLines={1}>
          {meal.name}
        </Text>
        <Text style={styles.total}>
          {formatEnergy(meal.total.kcal, unit)}
          {meal.goalKcal != null ? <Text style={styles.of}> / {formatEnergy(meal.goalKcal, unit)}</Text> : null}
        </Text>
      </View>

      {meal.entries.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => onPressEntry(e)}
          style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${e.name}, ${formatAmount(e.amount, e.unit)}, ${formatEnergy(e.nutrients.kcal, unit)}. Edit`}
        >
          <View style={styles.entryText}>
            <Text style={text.body} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {[e.brand, e.source === 'quick' ? null : formatAmount(e.amount, e.unit)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={styles.kcal}>{formatEnergy(e.nutrients.kcal, unit)}</Text>
        </Pressable>
      ))}

      <View style={styles.footer}>
        <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add food to ${meal.name}`}>
          <Text style={styles.link}>Add food</Text>
        </Pressable>
        {meal.entries.length === 0 && onCopy && copyLabel ? (
          <Pressable onPress={onCopy} hitSlop={8} accessibilityRole="button">
            <Text style={styles.quiet}>{copyLabel}</Text>
          </Pressable>
        ) : null}
        {meal.entries.length > 0 && onSaveMeal ? (
          <Pressable onPress={onSaveMeal} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Save ${meal.name} as a meal`}>
            <Text style={styles.quiet}>Save as a meal</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  total: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  of: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  entryText: { flex: 1, minWidth: 0 },
  kcal: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs },
  link: { color: colors.primary, fontWeight: '700' },
  quiet: { color: colors.textMuted, fontWeight: '600' },
});
