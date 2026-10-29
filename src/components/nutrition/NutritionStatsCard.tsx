import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { useDiaryRange, useNutritionGoals, useNutritionSettings } from '@/data/nutrition';
import { energyUnitLabel, formatEnergy } from '@/domain/nutrition/diary';
import { rangeStart, reportDays, reportSummary } from '@/domain/nutrition/reports';
import { DEFAULT_NUTRITION_SETTINGS } from '@/domain/nutrition/settings';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** The last seven days of food on the Stats tab, and the way into the reports. Shown only with access. */
export function NutritionStatsCard() {
  const router = useRouter();
  const today = todayLocal();
  const from = rangeStart('week', today);
  const entries = useDiaryRange(from, today);
  const goals = useNutritionGoals();
  const unit = (useNutritionSettings().data ?? DEFAULT_NUTRITION_SETTINGS).energyUnit;
  const summary = reportSummary(reportDays(entries.data ?? [], goals.data ?? [], from, today));

  const words =
    summary.averageKcal == null
      ? 'Log food to see your weekly calories, macros and nutrients here.'
      : `A day, over the ${summary.daysLogged === 1 ? '1 day' : `${summary.daysLogged} days`} logged this past week` +
        (summary.averageGoalKcal != null ? ` · goal ${formatEnergy(summary.averageGoalKcal, unit)}` : '');

  return (
    <Pressable
      onPress={() => router.push('/nutrition/reports')}
      accessibilityRole="button"
      accessibilityLabel={`Nutrition. ${summary.averageKcal == null ? '' : `${formatEnergy(summary.averageKcal, unit)} ${energyUnitLabel(unit)}. `}${words}`}
      accessibilityHint="Opens your nutrition reports"
    >
      <Card title="Nutrition">
        <View style={styles.row}>
          <Text style={text.stat}>
            {summary.averageKcal == null ? '—' : `${formatEnergy(summary.averageKcal, unit)} ${energyUnitLabel(unit)}`}
          </Text>
          <Text style={styles.link}>Open ›</Text>
        </View>
        <Text style={text.bodyMuted}>{words}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  link: { color: colors.primary, fontWeight: '700' },
});
