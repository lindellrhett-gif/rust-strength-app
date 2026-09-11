import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, LoadingView } from '@/components';
import { RestTimerBar } from '@/components/RestTimerBar';
import { SaveTemplateModal } from '@/components/SaveTemplateModal';
import { WorkoutTimer } from '@/components/WorkoutTimer';
import { useProfile } from '@/data/profile';
import { useDeleteSet, useSetsForWorkout } from '@/data/sets';
import {
  useRemoveWorkoutExercise,
  useSaveWorkoutAsTemplate,
  useWorkoutExercises,
} from '@/data/templates';
import { useDeleteWorkout, useEndWorkout, useWorkout } from '@/data/workouts';
import { type GroupableSet } from '@/domain/grouping';
import {
  buildWorkoutBlocks,
  nextUpBlock,
  planProgress,
  type WorkoutBlock,
} from '@/domain/templates';
import { trimWeight } from '@/lib/format';
import { colors, rpeColor } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const workout = useWorkout(id);
  const sets = useSetsForWorkout(id);
  const slots = useWorkoutExercises(id);
  const profile = useProfile();
  const endWorkout = useEndWorkout();
  const cancelWorkout = useDeleteWorkout();
  const deleteSet = useDeleteSet(id!);
  const removeSlot = useRemoveWorkoutExercise(id!);
  const saveAsTemplate = useSaveWorkoutAsTemplate();

  const [showSave, setShowSave] = useState(false);

  const unit = profile.data?.unit ?? 'lb';

  const groupable: GroupableSet[] = useMemo(
    () =>
      (sets.data ?? []).map((s) => ({
        id: s.id,
        exerciseId: s.exercise_id,
        exerciseName: s.exercise?.name ?? 'Exercise',
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        isWarmup: s.is_warmup,
        isBodyweight: s.is_bodyweight,
        e1rm: s.e1rm,
        orderIndex: s.order_index,
      })),
    [sets.data],
  );

  const blocks = useMemo(
    () => buildWorkoutBlocks(slots.data ?? [], groupable),
    [slots.data, groupable],
  );
  const progress = useMemo(() => planProgress(blocks), [blocks]);
  const upNext = useMemo(() => nextUpBlock(blocks), [blocks]);

  if (workout.isLoading) return <LoadingView />;
  if (!workout.data) return <EmptyState title="Workout not found" />;

  const inProgress = !workout.data.ended_at;
  const volume = blocks.reduce((sum, b) => sum + b.volume, 0);
  const workingCount = groupable.filter((s) => !s.isWarmup).length;
  const hasSets = groupable.length > 0;

  const addSetFor = (exerciseId?: string) =>
    router.push({
      pathname: '/set/new',
      params: exerciseId ? { workoutId: id, exerciseId } : { workoutId: id },
    });

  const finish = () => {
    const unfinished = progress.target > 0 && !progress.complete;
    Alert.alert(
      'Finish workout?',
      unfinished
        ? `You've done ${progress.done} of ${progress.target} planned sets.`
        : 'You can still view it in your history afterwards.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            endWorkout.end(id!);
            router.replace({ pathname: '/workout/summary', params: { id } });
          },
        },
      ],
    );
  };

  /**
   * Started by mistake? Delete it outright rather than ending it, so it never
   * reaches history and cannot skew streaks or totals. Sets cascade with it.
   */
  const cancel = () => {
    const warning = hasSets
      ? `This deletes the session and all ${workingCount} set${workingCount === 1 ? '' : 's'} in it. It won't appear in your history.`
      : "This session won't appear in your history.";
    Alert.alert('Cancel this workout?', warning, [
      { text: 'Keep workout', style: 'cancel' },
      {
        text: 'Delete it',
        style: 'destructive',
        onPress: async () => {
          await cancelWorkout.mutateAsync(id!);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const confirmDelete = (setId: string) =>
    Alert.alert('Delete set?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSet.mutate(setId) },
    ]);

  const confirmRemoveSlot = (block: WorkoutBlock) => {
    const slot = (slots.data ?? []).find((s) => s.exerciseId === block.exerciseId);
    if (!slot) return;
    Alert.alert('Remove from this workout?', `${block.exerciseName} — sets you logged stay.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSlot.mutate(slot.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: inProgress ? 'Active workout' : 'Workout' }} />

      <View style={styles.summary}>
        <WorkoutTimer
          startedAt={workout.data.started_at}
          endedAt={workout.data.ended_at}
          label={inProgress ? 'elapsed' : 'total time'}
        />
        <View>
          <Text style={text.stat}>{trimWeight(volume)}</Text>
          <Text style={text.caption}>{unit} volume</Text>
        </View>
        <View>
          <Text style={text.stat}>
            {progress.target > 0 ? `${progress.done}/${progress.target}` : workingCount}
          </Text>
          <Text style={text.caption}>{progress.target > 0 ? 'planned sets' : 'working sets'}</Text>
        </View>
      </View>

      {inProgress ? (
        <View style={styles.restWrap}>
          <RestTimerBar />
        </View>
      ) : null}

      {inProgress && upNext ? (
        <Pressable style={styles.upNext} onPress={() => addSetFor(upNext.exerciseId)}>
          <View style={styles.upNextText}>
            <Text style={text.label}>UP NEXT</Text>
            <Text style={text.heading}>{upNext.exerciseName}</Text>
            <Text style={text.caption}>
              {upNext.workingSets}/{upNext.targetSets} sets
              {upNext.targetRepLow != null
                ? ` · ${upNext.targetRepLow}–${upNext.targetRepHigh} reps`
                : ''}
              {upNext.suggestedWeight != null && upNext.workingSets === 0
                ? ` · try ${trimWeight(upNext.suggestedWeight)} ${unit}`
                : ''}
            </Text>
          </View>
          <Text style={styles.upNextGo}>Log ›</Text>
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {blocks.length === 0 ? (
          <Text style={[text.bodyMuted, styles.empty]}>
            {sets.isLoading || slots.isLoading
              ? ''
              : 'Nothing here yet. Add a set, or start from a preset next time.'}
          </Text>
        ) : (
          blocks.map((b) => (
            <ExerciseBlock
              key={b.key}
              block={b}
              unit={unit}
              inProgress={inProgress}
              onDeleteSet={confirmDelete}
              onAddSet={() => addSetFor(b.exerciseId)}
              onRemoveSlot={() => confirmRemoveSlot(b)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        {inProgress ? (
          <>
            <Button label="+ Add exercise or set" size="lg" onPress={() => addSetFor()} />
            <View style={styles.footerRow}>
              <Button
                label="Cancel workout"
                variant="danger"
                onPress={cancel}
                loading={cancelWorkout.isPending}
                style={styles.footerBtn}
              />
              <Button
                label="Finish"
                variant="secondary"
                onPress={finish}
                loading={endWorkout.isPending}
                style={styles.footerBtn}
              />
            </View>
          </>
        ) : (
          <View style={styles.footerRow}>
            <Button
              label="Save as preset"
              variant="secondary"
              onPress={() => setShowSave(true)}
              disabled={!hasSets}
              style={styles.footerBtn}
            />
            <Button
              label="Back"
              variant="secondary"
              onPress={() => router.back()}
              style={styles.footerBtn}
            />
          </View>
        )}
      </View>

      <SaveTemplateModal
        visible={showSave}
        busy={saveAsTemplate.isPending}
        exerciseNames={blocks.filter((b) => b.sets.length > 0).map((b) => b.exerciseName)}
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

function ExerciseBlock({
  block,
  unit,
  inProgress,
  onDeleteSet,
  onAddSet,
  onRemoveSlot,
}: {
  block: WorkoutBlock;
  unit: string;
  inProgress: boolean;
  onDeleteSet: (id: string) => void;
  onAddSet: () => void;
  onRemoveSlot: () => void;
}) {
  // Warmups are labelled "W"; working sets numbered 1..n within the block.
  const rows = block.sets.map((set, i) => ({
    set,
    badge: set.isWarmup
      ? 'W'
      : String(block.sets.slice(0, i + 1).filter((x) => !x.isWarmup).length),
  }));

  const empty = block.sets.length === 0;

  return (
    <View style={[styles.card, block.complete && styles.cardComplete]}>
      <Pressable
        onLongPress={() => inProgress && block.planned && onRemoveSlot()}
        style={styles.cardHead}
      >
        <View style={styles.cardTitle}>
          <Text style={text.heading}>{block.exerciseName}</Text>
          {!block.planned && block.sets.length > 0 ? (
            <Text style={styles.adhocTag}>added</Text>
          ) : null}
        </View>
        <Text style={[text.caption, block.complete && styles.completeText]}>
          {block.targetSets != null
            ? `${block.workingSets}/${block.targetSets}${block.complete ? ' ✓' : ''}`
            : `${block.workingSets} set${block.workingSets === 1 ? '' : 's'}`}
        </Text>
      </Pressable>

      {empty ? (
        <Pressable style={styles.emptySlot} onPress={onAddSet} disabled={!inProgress}>
          <Text style={text.bodyMuted}>
            {block.targetRepLow != null
              ? `${block.targetSets} × ${block.targetRepLow}–${block.targetRepHigh} reps`
              : 'No sets yet'}
            {block.suggestedWeight != null
              ? ` · try ${trimWeight(block.suggestedWeight)} ${unit}`
              : ''}
          </Text>
          {inProgress ? <Text style={styles.emptySlotGo}>Log first set ›</Text> : null}
        </Pressable>
      ) : (
        rows.map(({ set: s, badge }) => (
          <Pressable
            key={s.id}
            onLongPress={() => inProgress && onDeleteSet(s.id)}
            style={({ pressed }) => [styles.setRow, pressed && styles.setRowPressed]}
          >
            <Text style={styles.setNum}>{badge}</Text>
            <Text style={styles.setMain}>
              {s.isBodyweight ? 'BW' : trimWeight(s.weight)}
              {s.isBodyweight && s.weight > 0 ? (
                <Text style={text.caption}>{`  (${trimWeight(s.weight)})`}</Text>
              ) : null}
              <Text style={text.bodyMuted}>{'   ×   '}</Text>
              {s.reps}
            </Text>
            {s.rpe != null ? (
              <View style={[styles.rpe, { borderColor: rpeColor(s.rpe) }]}>
                <Text style={[styles.rpeText, { color: rpeColor(s.rpe) }]}>{s.rpe}</Text>
              </View>
            ) : (
              <View style={styles.rpeSpacer} />
            )}
          </Pressable>
        ))
      )}

      {!empty ? (
        <View style={styles.cardFoot}>
          <Text style={text.caption}>
            {trimWeight(block.volume)} {unit} volume
          </Text>
          <View style={styles.footActions}>
            {block.bestE1rm != null ? (
              <Text style={text.caption}>e1RM {trimWeight(block.bestE1rm)}</Text>
            ) : null}
            {inProgress ? (
              <Pressable onPress={onAddSet} hitSlop={8}>
                <Text style={styles.addMore}>+ set</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  restWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  upNextText: { gap: 2, flexShrink: 1 },
  upNextGo: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardComplete: { borderColor: colors.success },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  adhocTag: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  completeText: { color: colors.success, fontWeight: '700' },
  emptySlot: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  emptySlotGo: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setRowPressed: { backgroundColor: colors.surfaceRaised },
  setNum: { width: 22, color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  setMain: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
  rpe: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    minWidth: 38,
    alignItems: 'center',
  },
  rpeText: { fontSize: 12, fontWeight: '700' },
  rpeSpacer: { minWidth: 38 },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  addMore: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerBtn: { flex: 1 },
});
