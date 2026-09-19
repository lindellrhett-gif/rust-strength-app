import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, Field, LoadingView } from '@/components';
import { NumberStepper } from '@/components/NumberStepper';
import { keyboardAware } from '@/components/keyboard';
import { useProfile } from '@/data/profile';
import { useSetsForWorkout, type SetWithRefs } from '@/data/sets';
import { useSaveWorkoutReview, useWorkout } from '@/data/workouts';
import { MAX_REPS } from '@/domain/recommender';
import {
  MAX_NAME_LENGTH,
  editableValue,
  endedAtFor,
  isChanged,
  lengthProblem,
  normalizeWorkoutName,
  patchForEdit,
  setKind,
  workoutLengthSeconds,
  type SetEdit,
} from '@/domain/workoutEdit';
import { formatTime } from '@/lib/dates';
import { useIsOnline } from '@/lib/network';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

interface Draft {
  name: string;
  lengthSeconds: number;
  edits: Record<string, SetEdit>;
}

/**
 * Review a workout: fix its name, its length (for a Finish tapped late) and
 * any weight or reps logged wrong.
 *
 * Opened straight after Finish (`from=finish`, which continues to the summary)
 * and from a past workout's Edit button (which returns to it).
 */
export default function ReviewWorkout() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const afterFinish = from === 'finish';
  const router = useRouter();
  const workout = useWorkout(id);
  const sets = useSetsForWorkout(id);
  const profile = useProfile();
  const save = useSaveWorkoutReview();
  const online = useIsOnline();
  const unit = profile.data?.unit ?? 'lb';

  const [draft, setDraft] = useState<Draft | null>(null);
  // Filled in once, when both have loaded; later refetches must not wipe edits.
  if (draft == null && workout.data && sets.data) {
    const w = workout.data;
    setDraft({
      name: w.name ?? '',
      lengthSeconds: workoutLengthSeconds(w.started_at, w.ended_at ?? new Date().toISOString()),
      edits: Object.fromEntries(
        sets.data.map((s) => [s.id, { value: editableValue(s), reps: s.reps }]),
      ),
    });
  }

  const groups = useMemo(() => groupByExercise(sets.data ?? []), [sets.data]);

  if (workout.isLoading || sets.isLoading || (!draft && workout.data)) return <LoadingView />;
  if (!workout.data || !draft) return <EmptyState title="Workout not found" />;

  const w = workout.data;
  const problem = lengthProblem(draft.lengthSeconds);
  const hours = Math.floor(draft.lengthSeconds / 3600);
  const minutes = Math.floor((draft.lengthSeconds % 3600) / 60);
  const endedAt = endedAtFor(w.started_at, draft.lengthSeconds);

  const changedSets = (sets.data ?? []).filter((s) => {
    const e = draft.edits[s.id];
    return e != null && isChanged(s, e);
  });
  const name = normalizeWorkoutName(draft.name);
  const workoutChanged =
    name !== (w.name ?? null) ||
    draft.lengthSeconds !== workoutLengthSeconds(w.started_at, w.ended_at);
  const anyChange = workoutChanged || changedSets.length > 0;

  const leave = () => {
    if (afterFinish) router.replace({ pathname: '/workout/summary', params: { id } });
    else router.back();
  };

  const setLength = (h: number, m: number) =>
    setDraft({ ...draft, lengthSeconds: h * 3600 + m * 60 });

  const setEdit = (setId: string, patch: Partial<SetEdit>) =>
    setDraft({ ...draft, edits: { ...draft.edits, [setId]: { ...draft.edits[setId], ...patch } } });

  const submit = () => {
    if (problem) return;
    if (!anyChange) {
      leave();
      return;
    }
    if (!online) {
      Alert.alert(
        'No connection',
        'Saving changes needs a connection. Your workout is already saved as it was, and you can edit it later from the Calendar.',
        afterFinish
          ? [
              { text: 'Stay here', style: 'cancel' },
              { text: 'Skip for now', onPress: leave },
            ]
          : [{ text: 'OK' }],
      );
      return;
    }
    save.mutate(
      {
        id: id!,
        name,
        endedAt,
        sets: changedSets.map((s) => ({ id: s.id, patch: patchForEdit(s, draft.edits[s.id]) })),
      },
      {
        onSuccess: leave,
        onError: (e) =>
          Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.'),
      },
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Review workout',
          // After Finish the session is over; the way on is Save.
          headerBackVisible: !afterFinish,
          gestureEnabled: !afterFinish,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
        {afterFinish ? (
          <Text style={text.bodyMuted}>
            Check everything looks right before it goes into your history.
          </Text>
        ) : null}

        <Card title="Name">
          <Field
            label="Saved as"
            value={draft.name}
            onChangeText={(t) => setDraft({ ...draft, name: t })}
            placeholder="Workout"
            maxLength={MAX_NAME_LENGTH}
          />
        </Card>

        <Card title="Length">
          <View style={styles.row}>
            <View style={styles.cell}>
              <NumberStepper
                label="Hours"
                value={hours}
                onChange={(h) => setLength(h, minutes)}
                min={0}
                max={12}
              />
            </View>
            <View style={styles.cell}>
              <NumberStepper
                label="Minutes"
                value={minutes}
                onChange={(m) => setLength(hours, m)}
                min={0}
                max={59}
                step={5}
              />
            </View>
          </View>
          <Text style={[text.caption, problem ? styles.problem : null]}>
            {problem ?? `Started ${formatTime(w.started_at)} · ended ${formatTime(endedAt)}`}
          </Text>
          <Text style={text.caption}>Forgot to tap Finish? Set how long you actually trained.</Text>
        </Card>

        {groups.map((g) => (
          <Card key={g.exerciseId} title={g.name}>
            {g.sets.map((s, i) => {
              const kind = setKind(s);
              const e = draft.edits[s.id];
              const working = g.sets.slice(0, i + 1).filter((x) => !x.is_warmup).length;
              return (
                <View key={s.id} style={styles.set}>
                  <Text style={text.label}>{s.is_warmup ? 'WARMUP' : `SET ${working}`}</Text>
                  <View style={styles.row}>
                    <View style={styles.cell}>
                      <NumberStepper
                        label={valueLabel(kind, unit)}
                        value={e.value}
                        onChange={(v) => setEdit(s.id, { value: v })}
                        min={kind === 'timed' ? 1 : 0}
                        max={kind === 'timed' ? 3600 : 2000}
                        step={kind === 'timed' ? 5 : (s.machine?.increment ?? 5)}
                        precision={kind === 'timed' ? 0 : 1}
                      />
                    </View>
                    {kind !== 'timed' ? (
                      <View style={styles.cell}>
                        <NumberStepper
                          label="Reps"
                          value={e.reps}
                          onChange={(r) => setEdit(s.id, { reps: r })}
                          min={1}
                          max={MAX_REPS}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ))}

        {groups.length === 0 ? (
          <Text style={text.bodyMuted}>No sets were logged in this workout.</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={afterFinish ? 'Save workout' : anyChange ? 'Save changes' : 'Done'}
          size="lg"
          onPress={submit}
          loading={save.isPending}
          disabled={problem != null}
        />
      </View>
    </SafeAreaView>
  );
}

function valueLabel(kind: ReturnType<typeof setKind>, unit: string): string {
  switch (kind) {
    case 'timed':
      return 'Seconds';
    case 'assisted':
      return `Assist (${unit})`;
    case 'bodyweight':
      return `Added (${unit})`;
    case 'weighted':
      return `Weight (${unit})`;
  }
}

interface Group {
  exerciseId: string;
  name: string;
  sets: SetWithRefs[];
}

/** Sets grouped by exercise, in the order each exercise was first logged. */
function groupByExercise(sets: SetWithRefs[]): Group[] {
  const groups: Group[] = [];
  const byId = new Map<string, Group>();
  for (const s of [...sets].sort((a, b) => a.order_index - b.order_index)) {
    let g = byId.get(s.exercise_id);
    if (!g) {
      g = { exerciseId: s.exercise_id, name: s.exercise?.name ?? 'Exercise', sets: [] };
      byId.set(s.exercise_id, g);
      groups.push(g);
    }
    g.sets.push(s);
  }
  return groups;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
  set: { gap: spacing.xs, paddingVertical: spacing.xs },
  problem: { color: colors.danger },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
