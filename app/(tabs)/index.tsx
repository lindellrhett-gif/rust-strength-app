import { useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView } from '@/components';
import { WorkoutTimer } from '@/components/WorkoutTimer';
import { BodyChart } from '@/components/BodyChart';
import { TodayTiles } from '@/components/TodayTiles';
import { usePlannedSessions } from '@/data/planned';
import { useRestDays } from '@/data/restDays';
import { useProfile } from '@/data/profile';
import { useWeeklyCoverage, useTrainedDates } from '@/data/stats';
import { useStartWorkoutFromTemplate, useTemplates } from '@/data/templates';
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
              <Text style={text.heading}>New session</Text>
              <Text style={text.bodyMuted}>
                Log each set with weight, reps, RPE and the machine. You’ll get a suggested weight
                for the next set.
              </Text>
              <Button
                label="Start workout"
                onPress={go}
                size="lg"
                loading={startWorkout.isPending}
              />
              <View style={styles.secondaryRow}>
                <Button
                  label="Generate"
                  variant="secondary"
                  onPress={() => router.push('/generate')}
                  style={styles.secondaryBtn}
                />
                <Button
                  label="Presets"
                  variant="secondary"
                  onPress={() => router.push('/templates')}
                  style={styles.secondaryBtn}
                />
              </View>
              {hasFeature('running') ? (
                <Button
                  label={runInProgress ? 'Resume run' : 'Start a run'}
                  variant="secondary"
                  onPress={() => router.push('/run/record')}
                />
              ) : null}
              <Button
                label="Log an activity instead"
                variant="ghost"
                onPress={() => router.push('/activity/new')}
              />
            </>
          )}
        </Card>

        <Card title="Body chart">
          <BodyChart weekCoverage={coverage.data ?? {}} />
        </Card>

        <PresetShortcuts />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Jump straight into a saved preset from the home screen. */
function PresetShortcuts() {
  const router = useRouter();
  const templates = useTemplates();
  const start = useStartWorkoutFromTemplate();

  const list = templates.data ?? [];
  if (list.length === 0) return null;

  const go = async (templateId: string) => {
    try {
      const workoutId = await start.mutateAsync(templateId);
      router.push(`/workout/${workoutId}`);
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <Card title="Start from a preset">
      {list.slice(0, 5).map((t) => (
        <Pressable key={t.id} style={styles.presetRow} onPress={() => go(t.id)}>
          <View>
            <Text style={text.body}>{t.name}</Text>
            <Text style={text.caption}>
              {t.items.length} exercise{t.items.length === 1 ? '' : 's'} ·{' '}
              {t.items.reduce((n, i) => n + i.targetSets, 0)} sets
            </Text>
          </View>
          <Text style={styles.presetGo}>Start ›</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: { flex: 1 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  presetGo: { color: colors.primary, fontWeight: '800' },
});
