import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, LoadingView, Pill, StatTile } from '@/components';
import { useActivities, useActivityTotals } from '@/data/activities';
import { useProfile } from '@/data/profile';
import { useRestDays } from '@/data/restDays';
import {
  useAllTimeTotals,
  useExercisePRs,
  useWeeklyCoverage,
  useWorkoutDates,
} from '@/data/stats';
import {
  ACTIVITY_LABEL,
  activityTotals,
  topKind,
} from '@/domain/activities';
import { formatDurationShort } from '@/domain/duration';
import { bestStreak, currentStreak, MUSCLE_GROUPS, weekStart } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { compact, trimWeight } from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function Stats() {
  const router = useRouter();
  const profile = useProfile();
  const totals = useAllTimeTotals();
  const prs = useExercisePRs();
  const dates = useWorkoutDates();
  const thisWeek = weekStart(todayLocal());
  const coverage = useWeeklyCoverage(thisWeek);
  const activityTotalsQuery = useActivityTotals();
  const activities = useActivities();
  const restDays = useRestDays();

  const unit = profile.data?.unit ?? 'lb';
  const restDates = (restDays.data ?? []).map((r) => r.rest_date);
  const streak = currentStreak(dates.data ?? [], todayLocal(), restDates);
  const best = bestStreak(dates.data ?? [], restDates);

  const byKind = activityTotals(activities.data ?? []);
  const favourite = topKind(byKind);

  const refreshing =
    totals.isRefetching ||
    prs.isRefetching ||
    dates.isRefetching ||
    coverage.isRefetching ||
    activityTotalsQuery.isRefetching;

  if (totals.isLoading && prs.isLoading) return <LoadingView />;

  const refetchAll = () => {
    totals.refetch();
    prs.refetch();
    dates.refetch();
    coverage.refetch();
    activityTotalsQuery.refetch();
    activities.refetch();
    restDays.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.textMuted}
            refreshing={refreshing}
            onRefresh={refetchAll}
          />
        }
      >
        <View style={styles.tiles}>
          <StatTile value={`${streak}`} label="day streak" />
          <StatTile value={`${best}`} label="best streak" />
          <StatTile value={compact(totals.data?.volume ?? 0)} label={`${unit} all-time`} />
          <StatTile value={compact(totals.data?.totalReps ?? 0)} label="reps all-time" />
          <StatTile value={compact(totals.data?.totalSets ?? 0)} label="sets all-time" />
          <StatTile value={`${totals.data?.totalWorkouts ?? 0}`} label="workouts" />
          <StatTile
            value={formatDurationShort(totals.data?.totalSeconds ?? 0)}
            label="time training"
          />
        </View>

        <Card title="Activity time">
          <View style={styles.activityHead}>
            <View>
              <Text style={text.stat}>
                {formatDurationShort(activityTotalsQuery.data?.totalSeconds ?? 0)}
              </Text>
              <Text style={text.caption}>
                {activityTotalsQuery.data?.totalActivities ?? 0} activit
                {(activityTotalsQuery.data?.totalActivities ?? 0) === 1 ? 'y' : 'ies'}
                {favourite ? ` · mostly ${ACTIVITY_LABEL[favourite].toLowerCase()}` : ''}
              </Text>
            </View>
            <View style={styles.activityRight}>
              <Text style={text.stat}>
                {formatDurationShort(totals.data?.totalSeconds ?? 0)}
              </Text>
              <Text style={text.caption}>under the bar</Text>
            </View>
          </View>

          {Object.keys(byKind.byKind).length === 0 ? (
            <Text style={text.bodyMuted}>
              Runs, sports and cardio machines you log will be totalled here.
            </Text>
          ) : (
            Object.entries(byKind.byKind)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([kind, seconds]) => (
                <View key={kind} style={styles.kindRow}>
                  <Text style={text.body}>
                    {ACTIVITY_LABEL[kind as keyof typeof ACTIVITY_LABEL]}
                  </Text>
                  <Text style={text.caption}>{formatDurationShort(seconds)}</Text>
                </View>
              ))
          )}
        </Card>

        <Card title="This week — whole body">
          <View style={styles.groups}>
            {MUSCLE_GROUPS.map((g) => {
              const count = coverage.data?.[g] ?? 0;
              return (
                <View
                  key={g}
                  style={[styles.groupChip, count > 0 ? styles.groupHit : styles.groupMiss]}
                >
                  <Text style={[styles.groupText, count > 0 && styles.groupTextHit]}>
                    {g}
                    {count > 0 ? ` ·${count}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Card title="Personal records">
          {!prs.data?.length ? (
            <Text style={text.bodyMuted}>Log some working sets to start setting PRs.</Text>
          ) : (
            <Text style={text.caption}>Tap an exercise to see how it has moved over time.</Text>
          )}
          {!prs.data?.length ? null : (
            prs.data.map((pr) => (
              <Pressable
                key={pr.exerciseId}
                accessibilityRole="button"
                accessibilityLabel={`${pr.exerciseName} progress over time`}
                onPress={() => router.push(`/exercise/${pr.exerciseId}`)}
                style={({ pressed }) => [styles.prRow, pressed && styles.prRowPressed]}
              >
                <View style={styles.prMain}>
                  <Text style={text.body}>{pr.exerciseName}</Text>
                  <Pill label={pr.muscleGroup} />
                </View>
                <View style={styles.prNums}>
                  <Text style={styles.prBig}>
                    {trimWeight(pr.bestE1rm)} {unit}
                  </Text>
                  <Text style={text.caption}>e1RM · best set {trimWeight(pr.bestWeight)}</Text>
                </View>
                <Text style={styles.prChev}>›</Text>
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activityHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activityRight: { alignItems: 'flex-end' },
  kindRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  groupHit: { backgroundColor: colors.primary, borderColor: colors.primary },
  groupMiss: { backgroundColor: 'transparent', borderColor: colors.border },
  groupText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  groupTextHit: { color: colors.onPrimary },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prRowPressed: { backgroundColor: colors.surfaceRaised },
  prMain: { gap: spacing.xs, flexShrink: 1 },
  prNums: { alignItems: 'flex-end', gap: spacing.xs },
  prBig: { color: colors.text, fontSize: 16, fontWeight: '800' },
  prChev: { color: colors.textFaint, fontSize: 20, fontWeight: '700', marginLeft: spacing.sm },
});
