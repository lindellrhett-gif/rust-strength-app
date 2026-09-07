import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView, StatTile } from '@/components';
import { SaveTemplateModal } from '@/components/SaveTemplateModal';
import { TrophyIcon } from '@/components/TrophyIcon';
import { useProfile } from '@/data/profile';
import { useSetsForWorkout } from '@/data/sets';
import { useSaveWorkoutAsTemplate } from '@/data/templates';
import { useWorkout, useWorkoutSummary } from '@/data/workouts';
import { elapsedSeconds, formatDurationShort } from '@/domain/duration';
import { buildSummary, summaryHeadline } from '@/domain/workoutSummary';
import { compact, trimWeight } from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const workout = useWorkout(id);
  const sets = useSetsForWorkout(id);
  const rows = useWorkoutSummary(id);
  const profile = useProfile();
  const saveAsTemplate = useSaveWorkoutAsTemplate();

  const [showSave, setShowSave] = useState(false);

  const unit = profile.data?.unit ?? 'lb';

  const summary = useMemo(() => {
    const working = (sets.data ?? []).filter((s) => !s.is_warmup);
    return buildSummary(
      // ended_at is set by the time we get here, but fall back to "now" so a
      // summary opened on a still-open session shows a sane number.
      workout.data
        ? elapsedSeconds(workout.data.started_at, workout.data.ended_at ?? new Date())
        : 0,
      {
        totalVolume: working.reduce((n, s) => n + s.weight * s.reps, 0),
        totalReps: working.reduce((n, s) => n + s.reps, 0),
        totalSets: working.length,
      },
      rows.data ?? [],
    );
  }, [workout.data, sets.data, rows.data]);

  if (workout.isLoading || rows.isLoading) return <LoadingView />;

  const done = () => router.replace('/(tabs)');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Workout complete',
          // No back arrow: the session is finished, the way out is "Done".
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={text.hero}>{summaryHeadline(summary)}</Text>
          <Text style={text.bodyMuted}>
            {summary.exerciseCount} exercise{summary.exerciseCount === 1 ? '' : 's'} ·{' '}
            {formatDurationShort(summary.durationSeconds)}
          </Text>
        </View>

        <View style={styles.tiles}>
          <StatTile value={formatDurationShort(summary.durationSeconds)} label="time" />
          <StatTile value={compact(summary.totalVolume)} label={`${unit} lifted`} />
          <StatTile value={String(summary.totalSets)} label="working sets" />
          <StatTile value={String(summary.totalReps)} label="reps" />
        </View>

        {summary.records.length > 0 ? (
          <Card title={`Personal record${summary.records.length === 1 ? '' : 's'}`}>
            {summary.records.map((r) => (
              <View key={`${r.exerciseId}-${r.kind}`} style={styles.prRow}>
                <TrophyIcon glyph="stack" tier="gold" size={38} />
                <View style={styles.prMain}>
                  <Text style={text.body}>{r.exerciseName}</Text>
                  <Text style={text.caption}>
                    {r.kind === 'weight' ? 'Heaviest set' : 'Best estimated 1RM'}
                    {r.previous == null
                      ? ' · first time logged'
                      : ` · beat ${trimWeight(r.previous)} by ${trimWeight(r.delta ?? 0)}`}
                  </Text>
                </View>
                <Text style={styles.prValue}>
                  {trimWeight(r.value)} {unit}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card title="What you did">
          {summary.exercises.length === 0 ? (
            <Text style={text.bodyMuted}>No working sets were logged in this session.</Text>
          ) : (
            summary.exercises.map((e) => (
              <View key={e.exerciseId} style={styles.exRow}>
                <View style={styles.exMain}>
                  <Text style={text.body}>{e.exerciseName}</Text>
                  <Text style={text.caption}>
                    {e.workingSets} set{e.workingSets === 1 ? '' : 's'} · top{' '}
                    {trimWeight(e.bestWeight)} {unit} × {e.bestReps}
                  </Text>
                </View>
                <Text style={text.caption}>
                  {compact(e.volume)} {unit}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Save as preset"
          variant="secondary"
          onPress={() => setShowSave(true)}
          disabled={summary.empty}
        />
        <Button label="Done" size="lg" onPress={done} />
      </View>

      <SaveTemplateModal
        visible={showSave}
        busy={saveAsTemplate.isPending}
        exerciseNames={summary.exercises.map((e) => e.exerciseName)}
        onClose={() => setShowSave(false)}
        onSubmit={async (name) => {
          try {
            await saveAsTemplate.mutateAsync({ workoutId: id!, name });
            setShowSave(false);
            Alert.alert('Preset saved', `"${name}" is ready to plan or start from.`);
          } catch (e) {
            Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { gap: spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prMain: { flex: 1, gap: 2 },
  prValue: { color: colors.warning, fontSize: 16, fontWeight: '800' },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exMain: { gap: 2, flexShrink: 1 },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.sm,
  },
});
