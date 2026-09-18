import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView, StatTile } from '@/components';
import { LevelCard, levelTint } from '@/components/LevelCard';
import { SaveTemplateModal } from '@/components/SaveTemplateModal';
import { TrophyIcon } from '@/components/TrophyIcon';
import { useMyLevel } from '@/data/level';
import { useProfile, useUpdateProfile } from '@/data/profile';
import { useSetsForWorkout } from '@/data/sets';
import { useSaveWorkoutAsTemplate } from '@/data/templates';
import { useWorkout, useWorkoutSummary } from '@/data/workouts';
import { elapsedSeconds, formatDurationShort } from '@/domain/duration';
import { formatHold } from '@/domain/loadType';
import { buildSummary, summaryHeadline } from '@/domain/workoutSummary';
import { sessionXp } from '@/domain/xp';
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
  const updateProfile = useUpdateProfile();
  const saveAsTemplate = useSaveWorkoutAsTemplate();
  const { level, ready: levelReady } = useMyLevel();

  const [showSave, setShowSave] = useState(false);

  // Timed exercises: the longest hold per exercise. The summary's weight and
  // reps would read "0 lb × 1" for a plank, so its time is shown instead.
  const longestHold = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of sets.data ?? []) {
      if (s.is_warmup || s.duration_seconds == null) continue;
      out[s.exercise_id] = Math.max(out[s.exercise_id] ?? 0, s.duration_seconds);
    }
    return out;
  }, [sets.data]);
  /**
   * The level being celebrated, captured once. Holding it in state matters:
   * writing `level_seen` makes the "is this new?" test false again, and without
   * this the banner would appear and then vanish a moment later.
   */
  const [celebrating, setCelebrating] = useState<number | null>(null);

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

  const xpEarned = useMemo(
    () =>
      sessionXp({
        sets: summary.totalSets,
        volume: summary.totalVolume,
        records: summary.records.length,
        unit,
      }),
    [summary.totalSets, summary.totalVolume, summary.records.length, unit],
  );

  // Latched during render rather than in an effect: React's own pattern for
  // deriving state from changed inputs, and it avoids a frame where the banner
  // is missing. The effect below only performs the write.
  const seenLevel = profile.data?.level_seen ?? 1;
  if (celebrating == null && levelReady && level.level > seenLevel) {
    setCelebrating(level.level);
  }

  useEffect(() => {
    if (celebrating == null) return;
    updateProfile.mutate({ level_seen: celebrating });
    // `updateProfile` is a fresh object each render, so keying the effect to the
    // latched level is what keeps this to a single write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrating]);

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

        {celebrating != null ? (
          <View style={[styles.levelUp, { borderColor: levelTint(celebrating) }]}>
            <Text style={[styles.levelUpTitle, { color: levelTint(celebrating) }]}>
              Level {celebrating}
            </Text>
            <Text style={text.bodyMuted}>
              {level.title} — {level.maxed ? 'the top of the ladder' : `${level.title} rank reached`}
            </Text>
          </View>
        ) : null}

        <Card title={`+${xpEarned.total.toLocaleString('en-US')} XP this session`}>
          {xpEarned.sources
            .filter((source) => source.xp > 0)
            .map((source) => (
              <View key={source.id} style={styles.xpRow}>
                <View style={styles.xpMain}>
                  <Text style={text.body}>{source.label}</Text>
                  {source.detail ? <Text style={text.caption}>{source.detail}</Text> : null}
                </View>
                <Text style={styles.xpValue}>+{source.xp.toLocaleString('en-US')}</Text>
              </View>
            ))}
          {levelReady ? <LevelCard level={level} /> : null}
        </Card>

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
                    {longestHold[e.exerciseId] != null
                      ? `${formatHold(longestHold[e.exerciseId])} hold`
                      : `${trimWeight(e.bestWeight)} ${unit} × ${e.bestReps}`}
                  </Text>
                </View>
                {e.volume > 0 ? (
                  <Text style={text.caption}>
                    {compact(e.volume)} {unit}
                  </Text>
                ) : null}
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
  levelUp: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  levelUpTitle: { fontSize: 30, fontWeight: '800' },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  xpMain: { flex: 1, gap: 2 },
  xpValue: { color: colors.primary, fontSize: 16, fontWeight: '800' },
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
