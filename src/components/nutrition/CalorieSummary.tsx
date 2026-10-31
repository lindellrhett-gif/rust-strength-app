import { StyleSheet, Text, View } from 'react-native';

import { energyUnitLabel, formatEnergy, remainingLabel } from '@/domain/nutrition/diary';
import type { Budget } from '@/domain/nutrition/totals';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * "Goal - Food + Exercise = Remaining", as one line of numbers. Without a goal
 * it shows what was eaten, and the exercise if there was any.
 */
export function CalorieSummary({ budget, unit }: { budget: Budget; unit: 'kcal' | 'kj' }) {
  const label = energyUnitLabel(unit);
  if (budget.goal == null) {
    return (
      <View style={styles.wrap} accessible accessibilityLabel={`${formatEnergy(budget.food, unit)} ${label} eaten`}>
        <View style={styles.row}>
          <Part value={formatEnergy(budget.food, unit)} label="Food" />
          {budget.exercise > 0 ? <Part value={formatEnergy(budget.exercise, unit)} label="Exercise" /> : null}
        </View>
        <Text style={text.caption}>{label} · no calorie goal set</Text>
      </View>
    );
  }
  const remaining = budget.remaining ?? 0;
  const over = remaining < 0;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Goal ${budget.goal}, food ${budget.food}, exercise ${budget.exercise}, ${
        over ? `${-remaining} over` : `${remaining} remaining`
      }, ${label}`}
    >
      <View style={styles.row}>
        <Part value={formatEnergy(budget.goal, unit)} label="Goal" />
        <Text style={styles.op}>−</Text>
        <Part value={formatEnergy(budget.food, unit)} label="Food" />
        <Text style={styles.op}>+</Text>
        <Part value={formatEnergy(budget.exercise, unit)} label="Exercise" />
        <Text style={styles.op}>=</Text>
        <Part
          value={formatEnergy(Math.abs(remaining), unit)}
          label={remainingLabel(budget)}
          tint={over ? colors.danger : colors.success}
          strong
        />
      </View>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

function Part({ value, label, tint, strong }: { value: string; label: string; tint?: string; strong?: boolean }) {
  return (
    <View style={styles.part}>
      <Text style={[styles.value, strong && styles.strong, tint ? { color: tint } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.partLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  part: { flex: 1, alignItems: 'center', minWidth: 0 },
  value: { fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  strong: { fontSize: 20, fontWeight: '800' },
  partLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  op: { fontSize: 16, color: colors.textFaint, paddingTop: 2 },
});
