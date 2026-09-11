import { useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView, StatTile } from '@/components';
import { WorkoutTimer } from '@/components/WorkoutTimer';
import { BodyChart } from '@/components/BodyChart';
import { GlyphIcon } from '@/components/TrophyIcon';
import { usePlannedSessions } from '@/data/planned';
import { useRestDays } from '@/data/restDays';
import { useProfile } from '@/data/profile';
import {
  useAllTimeTotals,
  useTodayTotals,
  useWeeklyCoverage,
  useWorkoutDates,
} from '@/data/stats';
import { useStartWorkoutFromTemplate, useTemplates } from '@/data/templates';
import { useOpenWorkout, useStartWorkout } from '@/data/workouts';
import { formatDurationShort } from '@/domain/duration';
import { currentStreak, weekStart } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { compact } from '@/lib/format';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function Today() {
  const router = useRouter();
  const profile = useProfile();
  const open = useOpenWorkout();
  const today = useTodayTotals();
  const dates = useWorkoutDates();
  const restDays = useRestDays();
  const thisWeek = weekStart(todayLocal());
  const coverage = useWeeklyCoverage(thisWeek);
  const totals = useAllTimeTotals();
  const planned = usePlannedSessions();
  const startWorkout = useStartWorkout();

  const unit = profile.data?.unit ?? 'lb';
  const todayStr = todayLocal();
  const restDates = (restDays.data ?? []).map((r) => r.rest_date);
  const streak = currentStreak(dates.data ?? [], todayStr, restDates);
  const refreshing = today.isRefetching || dates.isRefetching || open.isRefetching;

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
              today.refetch();
              dates.refetch();
              open.refetch();
              planned.refetch();
            }}
          />
        }
      >
        <View>
          <Text style={text.bodyMuted}>
            {profile.data?.display_name ? `Hey ${profile.data.display_name}` : 'Ready to lift?'}
          </Text>
          {streak > 0 ? (
            <View style={styles.streakRow}>
              {/* The drawn flame, same one the streak trophy uses. */}
              <GlyphIcon glyph="flame" color={colors.warning} size={30} />
              <Text style={text.hero}>{streak}-day streak</Text>
            </View>
          ) : (
            <Text style={text.hero}>Start a streak today</Text>
          )}
        </View>

        <View style={styles.tiles}>
          <StatTile value={compact(today.data?.volume ?? 0)} label={`${unit} lifted today`} />
          <StatTile value={String(today.data?.sets ?? 0)} label="sets today" />
          <StatTile
            value={formatDurationShort(totals.data?.totalSeconds ?? 0)}
            label="total time training"
          />
          <StatTile value={String(totals.data?.totalWorkouts ?? 0)} label="workouts all-time" />
        </View>

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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
