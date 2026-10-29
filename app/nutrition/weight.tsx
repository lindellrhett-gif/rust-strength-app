import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, LoadingView } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { Chips } from '@/components/nutrition/Chips';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { WeightChart } from '@/components/nutrition/WeightChart';
import { useDeleteWeighIn, useNutritionSettings, useSaveWeighIn, useWeighIns } from '@/data/nutrition';
import { useProfile } from '@/data/profile';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import {
  formatWeight,
  formatWeightChange,
  parseWeight,
  RATE_WINDOW_DAYS,
  weeklyRate,
  weightIn,
  weightTrend,
  type WeightUnit,
} from '@/domain/nutrition/body';
import { dayLabel } from '@/domain/nutrition/diary';
import type { WeighIn } from '@/domain/nutrition/settings';
import { addDays } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

type ChartRange = 'month' | 'quarter' | 'year' | 'all';
const CHART_RANGES: { key: ChartRange; label: string; days: number | null }[] = [
  { key: 'month', label: '30 days', days: 30 },
  { key: 'quarter', label: '90 days', days: 90 },
  { key: 'year', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: null },
];
const HISTORY_SHOWN = 30;

/** "today", "yesterday", "on Tue, Oct 28". */
function whenWords(day: string, today: string): string {
  const label = dayLabel(day, today);
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : `on ${label}`;
}

/**
 * Weigh-ins: log one for any day up to today, see the smoothed trend and the
 * weekly rate, and delete a mistake. The latest weigh-in is also the
 * profile's bodyweight, which bodyweight exercises and run calories use.
 */
export default function WeightScreen() {
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
  return <Weight />;
}

function Weight() {
  const router = useRouter();
  const today = todayLocal();
  const profile = useProfile();
  const weighIns = useWeighIns();
  const settings = useNutritionSettings();
  const { save } = useSaveWeighIn();
  const { remove } = useDeleteWeighIn();
  const [day, setDay] = useState(today);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>('quarter');

  if (weighIns.isLoading || profile.isLoading) return <LoadingView />;
  const unit: WeightUnit = profile.data?.unit ?? 'lb';
  const list = weighIns.data ?? [];
  const existing = list.find((w) => w.measuredOn === day) ?? null;
  const trend = weightTrend(list);
  const latest = trend[trend.length - 1] ?? null;
  const rate = weeklyRate(list, today);
  const goalKg = settings.data?.goalWeightKg ?? null;
  const days = CHART_RANGES.find((r) => r.key === range)?.days ?? null;
  const shown = days == null ? trend : trend.filter((p) => p.day > addDays(today, -days));

  const submit = () => {
    const kg = parseWeight(typed, unit);
    if (kg == null) {
      setProblem(`Enter your weight in ${unit}.`);
      return;
    }
    setProblem(null);
    save(day, kg);
    setTyped('');
  };

  const confirmDelete = (w: WeighIn) =>
    Alert.alert(`Delete the weigh-in for ${dayLabel(w.measuredOn, today)}?`, formatWeight(w.kg, unit), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(w) },
    ]);

  const spoken =
    latest == null
      ? 'No weigh-ins yet'
      : `Weight trend ${formatWeight(latest.trendKg, unit)}` +
        (rate != null ? `, ${formatWeightChange(rate, unit)} a week` : '') +
        (goalKg != null ? `, goal ${formatWeight(goalKg, unit)}` : '');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        <Card title="Weigh-in">
          <View style={styles.dayNav}>
            <Pressable onPress={() => setDay(addDays(day, -1))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous day">
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={text.heading}>{dayLabel(day, today)}</Text>
            <Pressable
              onPress={() => setDay(addDays(day, 1))}
              disabled={day >= today}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Next day"
              accessibilityState={{ disabled: day >= today }}
            >
              <Text style={[styles.arrow, day >= today && styles.dim]}>›</Text>
            </Pressable>
          </View>
          <Field
            label={`Weight (${unit})`}
            value={typed}
            onChangeText={setTyped}
            placeholder={existing ? String(weightIn(existing.kg, unit)) : latest ? String(weightIn(latest.kg, unit)) : ''}
            keyboardType="decimal-pad"
            error={problem ?? undefined}
            onSubmitEditing={submit}
          />
          <Button label={existing ? 'Replace' : 'Save'} onPress={submit} disabled={typed.trim() === ''} />
          <Text style={text.caption}>
            {existing ? `Saved for this day: ${formatWeight(existing.kg, unit)}. One weigh-in a day. ` : ''}
            Your latest weigh-in is also your bodyweight on your profile.
          </Text>
        </Card>

        {latest ? (
          <Card title="Trend">
            <View style={styles.trendHead}>
              <View>
                <Text style={text.stat}>{formatWeight(latest.trendKg, unit)}</Text>
                <Text style={text.caption}>
                  trend · weighed {formatWeight(latest.kg, unit)} {whenWords(latest.day, today)}
                </Text>
              </View>
              {goalKg != null ? (
                <View style={styles.right}>
                  <Text style={styles.goal}>{formatWeight(goalKg, unit)}</Text>
                  <Text style={text.caption}>
                    goal · {weightIn(Math.abs(latest.trendKg - goalKg), unit) === 0 ? 'reached' : `${formatWeight(Math.abs(latest.trendKg - goalKg), unit)} to go`}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={text.bodyMuted}>
              {rate != null
                ? `${formatWeightChange(rate, unit)} a week over the last ${RATE_WINDOW_DAYS / 7} weeks.`
                : 'Weigh in a few times across a week or more to see your weekly rate.'}
            </Text>
            <Chips options={CHART_RANGES} selected={range} onSelect={setRange} accessibilityLabel="Chart range" />
            {shown.length > 0 ? (
              <WeightChart points={shown} unit={unit} goalKg={goalKg} today={today} summary={spoken} />
            ) : (
              <Text style={text.bodyMuted}>No weigh-ins in this range.</Text>
            )}
            <Text style={text.caption}>
              Dots are weigh-ins; the line smooths out day-to-day swings from water and food.
              {goalKg == null ? '' : ' The dashed line is your goal.'}
            </Text>
            {goalKg == null ? (
              <Pressable onPress={() => router.push('/nutrition/goals')} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>Set a goal weight</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : (
          <Text style={text.bodyMuted}>Log a weigh-in to start your trend. Weighing at the same time each day makes it steadier.</Text>
        )}

        {list.length > 0 ? (
          <Card title="History">
            {list.slice(0, HISTORY_SHOWN).map((w, i) => {
              const before = list[i + 1];
              return (
                <Pressable
                  key={w.measuredOn}
                  onPress={() => confirmDelete(w)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityHint="Asks whether to delete it"
                >
                  <Text style={[text.body, styles.flex]}>{dayLabel(w.measuredOn, today)}</Text>
                  {before ? <Text style={text.caption}>{formatWeightChange(w.kg - before.kg, unit)}</Text> : null}
                  <Text style={styles.value}>{formatWeight(w.kg, unit)}</Text>
                </Pressable>
              );
            })}
            {list.length > HISTORY_SHOWN ? (
              <Text style={text.caption}>
                Showing the latest {HISTORY_SHOWN} of {list.length}.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 32, color: colors.primary, paddingHorizontal: spacing.md, lineHeight: 34 },
  dim: { color: colors.textFaint },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  goal: { fontSize: 18, fontWeight: '700', color: colors.success },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1 },
  value: { fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'], minWidth: 80, textAlign: 'right' },
  link: { color: colors.primary, fontWeight: '700' },
});
