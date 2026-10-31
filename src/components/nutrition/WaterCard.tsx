import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAddWater, useDeleteWater, useWater } from '@/data/nutrition';
import { formatWater, waterButtons, type WeightUnit } from '@/domain/nutrition/body';
import { waterTotal } from '@/domain/nutrition/settings';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * The day's water: a total, a bar toward the goal if one is set, two
 * one-tap amounts and a way to take the last one back. Logging works offline.
 */
export function WaterCard({
  day,
  unit,
  goalMl,
  onSetGoal,
}: {
  day: string;
  unit: WeightUnit;
  goalMl: number | null;
  onSetGoal: () => void;
}) {
  const water = useWater(day);
  const { add } = useAddWater();
  const { remove } = useDeleteWater();
  const logs = water.data ?? [];
  const total = waterTotal(logs);
  const last = logs[logs.length - 1] ?? null;
  const fraction = goalMl ? Math.min(1, total / goalMl) : 0;

  return (
    <Card title="Water">
      <View style={styles.row} accessible accessibilityLabel={`Water: ${formatWater(total, unit)}${goalMl ? ` of ${formatWater(goalMl, unit)}` : ''}`}>
        <Text style={styles.total}>{formatWater(total, unit)}</Text>
        {goalMl ? <Text style={text.caption}>of {formatWater(goalMl, unit)}</Text> : null}
      </View>
      {goalMl ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
      ) : null}
      <View style={styles.buttons}>
        {waterButtons(unit).map((b) => (
          <Button
            key={b.ml}
            label={`Add ${b.label}`}
            variant="secondary"
            onPress={() => add(day, b.ml)}
            style={styles.button}
          />
        ))}
      </View>
      <View style={styles.footer}>
        {last ? (
          <Pressable onPress={() => remove(last)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove the last ${formatWater(last.ml, unit)}`}>
            <Text style={styles.quiet}>Remove last ({formatWater(last.ml, unit)})</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {!goalMl ? (
          <Pressable onPress={onSetGoal} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Set a goal</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  total: { fontSize: 20, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quiet: { color: colors.textMuted, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700' },
});
