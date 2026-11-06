import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components';
import { CalorieBars, type CalorieBar } from '@/components/nutrition/CalorieBars';
import { Chips } from '@/components/nutrition/Chips';
import { NutrientsCard } from '@/components/nutrition/NutrientsCard';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { nutritionDefaults, useDiaryRange, useNutritionGoals, useNutritionSettings, useWeighIns } from '@/data/nutrition';
import { useProfile } from '@/data/profile';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { formatWeight, formatWeightChange, weeklyRate, weightTrend } from '@/domain/nutrition/body';
import { energyUnitLabel, formatEnergy, formatGrams } from '@/domain/nutrition/diary';
import { emptyNutrients, NUTRIENT_KEYS, type Nutrients } from '@/domain/nutrition/nutrients';
import {
  RANGE_LABELS,
  rangeStart,
  reportDays,
  reportSummary,
  reportWeeks,
  type ReportRange,
  type ReportSummary,
} from '@/domain/nutrition/reports';
import { goalFor } from '@/domain/nutrition/totals';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const RANGES = (Object.keys(RANGE_LABELS) as ReportRange[]).map((key) => ({ key, label: RANGE_LABELS[key] }));
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MACRO_TINT = { carbs: colors.primary, protein: colors.success, fat: colors.warning } as const;

function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${m}/${d}`;
}

function weekday(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return WEEKDAY_LETTERS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** The day's averages as Nutrients, for the nutrients list. */
function averageNutrients(summary: ReportSummary): Nutrients {
  const out = emptyNutrients();
  out.kcal = summary.averageKcal ?? 0;
  for (const key of NUTRIENT_KEYS) if (key !== 'kcal') out[key] = summary.averages[key] ?? null;
  return out;
}

/**
 * Nutrition over the last 7 days, 30 days or 12 weeks: calories against the
 * goal, where they came from, nutrient averages and the weight trend.
 * Averages count only the days with food logged.
 */
export default function NutritionReportsScreen() {
  const access = useAccess();
  if (!hasFeature('nutrition', access)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <NutritionLocked />
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <Reports />;
}

function Reports() {
  const router = useRouter();
  const today = todayLocal();
  const [range, setRange] = useState<ReportRange>('week');
  const from = rangeStart(range, today);
  const entries = useDiaryRange(from, today);
  const goals = useNutritionGoals();
  const settings = useNutritionSettings();
  const weighIns = useWeighIns();
  const profile = useProfile();
  const s = settings.data ?? nutritionDefaults();
  const unit = s.energyUnit;
  const weightUnit = profile.data?.unit ?? 'lb';

  const days = reportDays(entries.data ?? [], goals.data ?? [], from, today);
  const summary = reportSummary(days);
  const goal = goalFor(goals.data ?? [], today);
  const energy = (kcal: number) => `${formatEnergy(kcal, unit)} ${energyUnitLabel(unit)}`;

  const bars: CalorieBar[] =
    range === 'quarter'
      ? reportWeeks(days).map((w) => ({ key: w.week, label: shortDate(w.week), kcal: w.averageKcal, goalKcal: w.averageGoalKcal }))
      : days.map((d) => ({
          key: d.day,
          label: range === 'week' ? weekday(d.day) : shortDate(d.day),
          kcal: d.logged ? d.total.kcal : null,
          goalKcal: d.goalKcal,
        }));
  const chartSummary =
    summary.averageKcal == null
      ? `Nothing logged in the last ${RANGE_LABELS[range]}`
      : `Calories over the last ${RANGE_LABELS[range]}: average ${energy(summary.averageKcal)} a day on the days logged` +
        (summary.averageGoalKcal != null ? `, goal ${energy(summary.averageGoalKcal)}` : '');

  const trend = weightTrend(weighIns.data ?? []);
  const latest = trend[trend.length - 1] ?? null;
  const rate = weeklyRate(weighIns.data ?? [], today);
  const share = summary.macroShare;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl tintColor={colors.textMuted} refreshing={entries.isRefetching} onRefresh={() => void entries.refetch()} />
        }
      >
        <Chips options={RANGES} selected={range} onSelect={setRange} accessibilityLabel="Report range" />

        <Card title="Calories">
          {entries.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : entries.error && !entries.data ? (
            <Text style={text.bodyMuted}>Reports need a connection to load. Pull down to try again.</Text>
          ) : summary.averageKcal == null ? (
            <Text style={text.bodyMuted}>Nothing logged in the last {RANGE_LABELS[range]}.</Text>
          ) : (
            <>
              <View style={styles.head}>
                <View>
                  <Text style={text.stat}>{formatEnergy(summary.averageKcal, unit)}</Text>
                  <Text style={text.caption}>
                    {energyUnitLabel(unit)} a day · {summary.daysLogged} of {summary.days} days logged
                  </Text>
                </View>
                {summary.averageGoalKcal != null ? (
                  <View style={styles.right}>
                    <Text style={styles.goal}>{formatEnergy(summary.averageGoalKcal, unit)}</Text>
                    <Text style={text.caption}>goal</Text>
                  </View>
                ) : null}
              </View>
              {summary.daysWithGoal > 0 ? (
                <Text style={text.bodyMuted}>
                  At or under the goal on {summary.daysAtOrUnderGoal} of {summary.daysWithGoal} logged{' '}
                  {summary.daysWithGoal === 1 ? 'day' : 'days'}.
                </Text>
              ) : null}
              <CalorieBars bars={bars} unit={unit} summary={chartSummary} />
              <Text style={text.caption}>
                {range === 'quarter' ? 'Each bar is a week’s daily average over the days logged. ' : 'Days with nothing logged have no bar. '}
                The green line is the goal, before any exercise is added.
              </Text>
            </>
          )}
        </Card>

        {share && summary.daysLogged > 0 ? (
          <Card title="Where the calories came from">
            <View style={styles.shareBar} accessible accessibilityLabel={`Carbs ${share.carbsPct}%, protein ${share.proteinPct}%, fat ${share.fatPct}%`}>
              <View style={{ flex: share.carbsPct, backgroundColor: MACRO_TINT.carbs }} />
              <View style={{ flex: share.proteinPct, backgroundColor: MACRO_TINT.protein }} />
              <View style={{ flex: share.fatPct, backgroundColor: MACRO_TINT.fat }} />
            </View>
            {(
              [
                ['carbs', 'Carbs', share.carbsPct, summary.averages.carbsG, goal?.carbsG],
                ['protein', 'Protein', share.proteinPct, summary.averages.proteinG, goal?.proteinG],
                ['fat', 'Fat', share.fatPct, summary.averages.fatG, goal?.fatG],
              ] as const
            ).map(([key, label, pct, grams, target]) => (
              <View key={key} style={styles.macroRow}>
                <View style={[styles.dot, { backgroundColor: MACRO_TINT[key] }]} />
                <Text style={[text.body, styles.flex]}>
                  {label} {pct}%
                </Text>
                <Text style={styles.value}>
                  {formatGrams(grams ?? null)}
                  {target != null ? <Text style={text.caption}> / {Math.round(target)} g</Text> : null}
                </Text>
              </View>
            ))}
            <Text style={text.caption}>Grams are daily averages; targets are today’s goal.</Text>
          </Card>
        ) : null}

        {summary.daysLogged > 0 ? (
          <NutrientsCard
            key={range}
            title="Daily averages"
            total={averageNutrients(summary)}
            goal={goal}
            netCarbs={s.netCarbs}
            startOpen
            note="Averaged over the days logged. A food that doesn’t list a nutrient adds nothing to it, so some of these can read low."
          />
        ) : null}

        <Pressable onPress={() => router.push('/nutrition/weight')} accessibilityRole="button" accessibilityHint="Opens your weigh-ins">
          <Card title="Weight">
            <View style={styles.head}>
              <Text style={text.stat}>{latest ? formatWeight(latest.trendKg, weightUnit) : 'No weigh-ins'}</Text>
              <Text style={styles.link}>Open ›</Text>
            </View>
            <Text style={text.bodyMuted}>
              {latest == null
                ? 'Log a weigh-in to see your trend.'
                : rate != null
                  ? `Trend, ${formatWeightChange(rate, weightUnit)} a week over the last 4 weeks.`
                  : 'Trend. A few more weigh-ins across a week give a weekly rate.'}
            </Text>
          </Card>
        </Pressable>

        <Text style={text.caption}>
          Food numbers come from labels, USDA FoodData Central and Open Food Facts, and from what you type in. They are
          estimates.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  right: { alignItems: 'flex-end' },
  goal: { fontSize: 18, fontWeight: '700', color: colors.success, fontVariant: ['tabular-nums'] },
  shareBar: { flexDirection: 'row', height: 10, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  value: { fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  link: { color: colors.primary, fontWeight: '700' },
});
