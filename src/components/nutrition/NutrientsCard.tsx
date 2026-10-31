import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { formatGrams } from '@/domain/nutrition/diary';
import type { Nutrients } from '@/domain/nutrition/nutrients';
import { nutrientRows, type NutrientRow } from '@/domain/nutrition/targets';
import type { NutritionGoal } from '@/domain/nutrition/totals';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** "2,300 mg", "12 g", "—". */
export function formatNutrient(value: number | null, unit: string): string {
  if (value == null) return '—';
  return unit === 'g' ? formatGrams(value) : `${Math.round(value).toLocaleString('en-US')} ${unit}`;
}

/**
 * Every label nutrient for a set of totals, against the goal's targets. A
 * limit gone over and a goal reached are marked in words as well as colour.
 * Starts folded on the diary; a report shows it open.
 */
export function NutrientsCard({
  total,
  goal,
  netCarbs,
  title = 'Nutrients',
  note,
  startOpen = false,
}: {
  total: Nutrients;
  goal: NutritionGoal | null;
  netCarbs: boolean;
  title?: string;
  note?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const rows = nutrientRows(total, goal, netCarbs);
  const flagged = rows.filter((r) => r.status === 'over').length;

  return (
    <Card title={title}>
      {open ? (
        <>
          {rows.map((r) => (
            <Row key={r.key} row={r} />
          ))}
          {note ? <Text style={text.caption}>{note}</Text> : null}
        </>
      ) : (
        <Text style={text.bodyMuted}>
          {flagged > 0 ? `${flagged === 1 ? '1 limit' : `${flagged} limits`} gone over. ` : ''}
          Fiber, sodium, sugars, vitamins and minerals.
        </Text>
      )}
      {startOpen ? null : (
        <Pressable onPress={() => setOpen(!open)} hitSlop={8} accessibilityRole="button" style={styles.toggle}>
          <Text style={styles.link}>{open ? 'Show less' : 'Show all nutrients'}</Text>
        </Pressable>
      )}
    </Card>
  );
}

function Row({ row }: { row: NutrientRow }) {
  const tint = row.status === 'over' ? colors.warning : row.status === 'met' ? colors.success : colors.text;
  const status = row.status === 'over' ? 'over' : row.status === 'met' ? 'reached' : null;
  const target = row.target == null ? null : `${row.kind === 'limit' ? 'limit ' : ''}${formatNutrient(row.target, row.unit)}`;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${row.label}: ${formatNutrient(row.eaten, row.unit)}${target ? `, ${target}` : ''}${status ? `, ${status}` : ''}`}
    >
      <Text style={[text.body, styles.flex]} numberOfLines={1}>
        {row.label}
      </Text>
      <View style={styles.right}>
        <Text style={[styles.value, { color: tint }]}>{formatNutrient(row.eaten, row.unit)}</Text>
        {target ? (
          <Text style={text.caption}>
            {target}
            {status ? ` · ${status}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  value: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  toggle: { alignSelf: 'flex-start' },
  link: { color: colors.primary, fontWeight: '700' },
});
