import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView } from '@/components';
import { WorkoutTimer } from '@/components/WorkoutTimer';
import { BodyChart } from '@/components/BodyChart';
import { TodayTiles } from '@/components/TodayTiles';
import { usePlannedSessions } from '@/data/planned';
import { useRestDays } from '@/data/restDays';
import { useProfile } from '@/data/profile';
import { useWeeklyCoverage, useTrainedDates } from '@/data/stats';
import { useOpenWorkout, useStartWorkout } from '@/data/workouts';
import { consistency } from '@/domain/achievements';
import { hasFeature } from '@/domain/entitlements';
import { currentStreak, weekStart } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { useRunInProgress } from '@/lib/useActiveRun';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function Today() {
  const router = useRouter();
  const profile = useProfile();
  const open = useOpenWorkout();
  const dates = useTrainedDates();
  const restDays = useRestDays();
  const thisWeek = weekStart(todayLocal());
  const coverage = useWeeklyCoverage(thisWeek);
  const planned = usePlannedSessions();
  const startWorkout = useStartWorkout();
  const runInProgress = useRunInProgress();

  const todayStr = todayLocal();
  const restDates = (restDays.data ?? []).map((r) => r.rest_date);
  const streak = currentStreak(dates.data ?? [], todayStr, restDates);
  // The same 30-day figure friends see on a profile: rest days count.
  const consistent = consistency(dates.data ?? [], todayStr, 30, restDates);
  const refreshing = dates.isRefetching || open.isRefetching || restDays.isRefetching;

  const todaysPlans = (planned.data ?? []).filter((p) => p.scheduled_for === todayStr);

  const go = () => {
    const workout = open.data ?? startWorkout.start();
    router.push(`/workout/${workout.id}`);
  };

  if (profile.isLoading && open.isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.textMuted}
            refreshing={refreshing}
            onRefresh={() => {
              dates.refetch();
              restDays.refetch();
              open.refetch();
              planned.refetch();
            }}
          />
        }
      >
        <TodayTiles consistency={consistent} streak={streak} />

        {todaysPlans.length > 0 ? (
          <Card title="Planned for today">
            {todaysPlans.map((p) => (
              <Text key={p.id} style={text.body}>
                {p.title}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card>
          {open.data ? (
            <>
              <Text style={text.heading}>Workout in progress</Text>
              <WorkoutTimer startedAt={open.data.started_at} label="elapsed" />
              <Button label="Resume workout" onPress={go} size="lg" />
            </>
          ) : (
            <>
              <Button
                label="Start workout"
                onPress={go}
                size="lg"
                loading={startWorkout.isPending}
              />
              {/* The other ways in, two to a row. */}
              <View style={styles.grid}>
                <View style={styles.gridRow}>
                  <Button
                    label="Generate"
                    variant="secondary"
                    onPress={() => router.push('/generate')}
                    style={styles.gridButton}
                  />
                  <Button
                    label="Presets"
                    variant="secondary"
                    onPress={() => router.push('/templates')}
                    style={styles.gridButton}
                  />
                </View>
                <View style={styles.gridRow}>
                  {hasFeature('running') ? (
                    <Button
                      label={runInProgress ? 'Resume run' : 'Start a run'}
                      variant="secondary"
                      onPress={() => router.push('/run/record')}
                      style={styles.gridButton}
                    />
                  ) : null}
                  <Button
                    label="Log activity"
                    variant="secondary"
                    onPress={() => router.push('/activity/new')}
                    style={styles.gridButton}
                  />
                </View>
              </View>
            </>
          )}
        </Card>

        {/* Takes the rest of the screen, so Today fits without scrolling. */}
        <Card style={styles.chartCard}>
          <BodyChart weekCoverage={coverage.data ?? {}} fill />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // flexGrow lets the body chart stretch to the bottom of the screen.
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  grid: { gap: spacing.sm },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
  gridButton: { flex: 1 },
  chartCard: { flexGrow: 1 },
});
