import { StyleSheet, Text, View } from 'react-native';

import { carbsShown, formatGrams } from '@/domain/nutrition/diary';
import type { NutrientKey, Nutrients } from '@/domain/nutrition/nutrients';
import type { Progress } from '@/domain/nutrition/totals';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const TINT: Partial<Record<NutrientKey, string>> = {
  carbsG: colors.primary,
  fatG: colors.warning,
  proteinG: colors.success,
};

/**
 * Carbs, fat and protein for the day. With macro goals, a bar each toward its
 * target; without, just the grams.
 */
export function MacroBars({
  total,
  progress,
  netCarbs,
}: {
  total: Nutrients;
  progress: Progress[];
  netCarbs: boolean;
}) {
  const carbs = carbsShown(total, netCarbs);
  const rows: { key: NutrientKey; label: string; eaten: number | null; target: number | null }[] = [
    { key: 'carbsG', label: carbs.label, eaten: carbs.grams, target: null },
    { key: 'fatG', label: 'Fat', eaten: total.fatG, target: null },
    { key: 'proteinG', label: 'Protein', eaten: total.proteinG, target: null },
  ];
  for (const p of progress) {
    const row = rows.find((r) => r.key === p.key);
    // Net carbs are shown against the carb goal as set; the bar stays honest
    // about which number it is.
    if (row) row.target = p.target;
  }

  return (
    <View style={styles.wrap}>
      {rows.map((r) => {
        const fraction = r.target && r.eaten != null ? Math.min(1, r.eaten / r.target) : 0;
        const over = r.target != null && r.eaten != null && r.eaten > r.target;
        return (
          <View key={r.key} style={styles.macro} accessible accessibilityLabel={`${r.label} ${formatGrams(r.eaten)}${r.target ? ` of ${Math.round(r.target)} grams` : ''}`}>
            <Text style={text.caption} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={styles.grams} numberOfLines={1}>
              {formatGrams(r.eaten)}
              {r.target ? <Text style={styles.of}> / {Math.round(r.target)} g</Text> : null}
            </Text>
            {r.target ? (
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(fraction * 100)}%`, backgroundColor: over ? colors.danger : TINT[r.key] },
                  ]}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md },
  macro: { flex: 1, gap: 2, minWidth: 0 },
  grams: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  of: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: radius.pill },
});
