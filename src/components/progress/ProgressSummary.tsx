import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MiniStat, MiniStatRow } from '../MiniStat';
import { useWeekFood } from '../nutrition/NutritionStatsCard';
import { useRunningWeek } from '../RunningCard';
import { SettingGroup, SettingRow } from '../SettingRow';
import { useProfile } from '@/data/profile';
import { useRestDays } from '@/data/restDays';
import { useAccess } from '@/data/subscription';
import { useAllTimeTotals, useExercisePRs, useTrainedDates } from '@/data/stats';
import { formatDurationShort } from '@/domain/duration';
import { hasFeature } from '@/domain/entitlements';
import { energyUnitLabel, formatEnergy } from '@/domain/nutrition/diary';
import { formatDistance } from '@/domain/running/units';
import { currentStreak } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { trimWeight } from '@/lib/format';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** How many records show on Progress; the rest are under All stats. */
const RECORDS_SHOWN = 3;

function SeeAll({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/stats')} hitSlop={14} accessibilityRole="link">
      <Text style={styles.link}>{label} ›</Text>
    </Pressable>
  );
}

/** Streak, workouts and time, with the way to every other number. */
export function ProgressHeadline() {
  const totals = useAllTimeTotals();
  const dates = useTrainedDates();
  const restDays = useRestDays();
  const rest = (restDays.data ?? []).map((r) => r.rest_date);

  return (
    <View style={styles.headline}>
      <MiniStatRow>
        <MiniStat
          value={dates.data ? String(currentStreak(dates.data, todayLocal(), rest)) : '—'}
          label="day streak"
        />
        <MiniStat value={totals.data ? String(totals.data.totalWorkouts) : '—'} label="workouts" />
        <MiniStat
          value={totals.data ? formatDurationShort(totals.data.totalSeconds) : '—'}
          label="training"
        />
      </MiniStatRow>
      <View style={styles.allStats}>
        <SeeAll label="All stats" />
      </View>
    </View>
  );
}

/** Your best three lifts; the full list is under All stats. */
export function TopRecords() {
  const router = useRouter();
  const profile = useProfile();
  const prs = useExercisePRs();
  const unit = profile.data?.unit ?? 'lb';
  const records = prs.data ?? [];

  if (records.length === 0) return null;

  return (
    <SettingGroup
      title="Personal records"
      help={{
        title: 'Personal records',
        body: 'Your estimated one-rep max on each lift, worked out from your working sets. It is an estimate, not a target. Tap a lift to see how it has moved over time.',
      }}
      action={records.length > RECORDS_SHOWN ? <SeeAll label={`See all ${records.length}`} /> : null}
    >
      {records.slice(0, RECORDS_SHOWN).map((pr) => (
        <SettingRow
          key={pr.exerciseId}
          label={pr.exerciseName}
          value={`${trimWeight(pr.bestE1rm)} ${unit}`}
          onPress={() => router.push(`/exercise/${pr.exerciseId}`)}
        />
      ))}
    </SettingGroup>
  );
}

function RunningTile() {
  const router = useRouter();
  const { distance, unit } = useRunningWeek();
  return (
    <MiniStat
      value={formatDistance(distance, unit)}
      label="running this week"
      onPress={() => router.push('/run')}
    />
  );
}

function FoodTile() {
  const router = useRouter();
  const { summary, unit } = useWeekFood();
  return (
    <MiniStat
      value={
        summary.averageKcal == null
          ? '—'
          : `${formatEnergy(summary.averageKcal, unit)} ${energyUnitLabel(unit)}`
      }
      label="food a day"
      onPress={() => router.push('/nutrition/reports')}
    />
  );
}

/** One tile each for running and food, which open their own screens. */
export function ProgressTiles() {
  const access = useAccess();
  const running = hasFeature('running');
  const food = hasFeature('nutrition', access);
  if (!running && !food) return null;
  return (
    <MiniStatRow>
      {running ? <RunningTile /> : null}
      {food ? <FoodTile /> : null}
    </MiniStatRow>
  );
}

const styles = StyleSheet.create({
  headline: { gap: spacing.sm },
  allStats: { alignItems: 'flex-end' },
  link: { ...text.caption, color: colors.primary, fontWeight: '700' },
});
