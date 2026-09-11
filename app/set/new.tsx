import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components';
import { CreateExerciseModal } from '@/components/CreateExerciseModal';
import { CreateMachineModal } from '@/components/CreateMachineModal';
import { NumberStepper } from '@/components/NumberStepper';
import { RestTimerBar } from '@/components/RestTimerBar';
import { RpeSelector } from '@/components/RpeSelector';
import { SelectSheet, type Option } from '@/components/SelectSheet';
import { useCreateExercise, useExercises } from '@/data/exercises';
import { useCreateMachine, useMachines } from '@/data/machines';
import { useProfile } from '@/data/profile';
import { useAddSet, useExerciseHistory, useSetsForWorkout } from '@/data/sets';
import { recommendNextWeight, repRangeOrDefault } from '@/domain/recommender';
import { roundToIncrement } from '@/domain/rounding';
import { trimWeight } from '@/lib/format';
import { useRestTimer } from '@/providers/RestTimerProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function NewSet() {
  const { workoutId, exerciseId: presetExerciseId } = useLocalSearchParams<{
    workoutId: string;
    exerciseId?: string;
  }>();
  const router = useRouter();

  const exercises = useExercises();
  const machines = useMachines();
  const profile = useProfile();
  const existingSets = useSetsForWorkout(workoutId);
  const createExercise = useCreateExercise();
  const createMachine = useCreateMachine();
  const addSet = useAddSet();
  const restTimer = useRestTimer();

  const [exerciseId, setExerciseId] = useState<string | null>(presetExerciseId ?? null);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [weight, setWeight] = useState(0);
  const [weightTouched, setWeightTouched] = useState(false);
  const [reps, setReps] = useState(8);
  const [rpe, setRpe] = useState<number | null>(null);
  const [isWarmup, setIsWarmup] = useState(false);
  const [isBodyweight, setIsBodyweight] = useState(false);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showMachinePicker, setShowMachinePicker] = useState(false);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [showCreateMachine, setShowCreateMachine] = useState(false);
  const [pendingName, setPendingName] = useState('');

  const exercise = exercises.data?.find((e) => e.id === exerciseId) ?? null;
  const machine = machines.data?.find((m) => m.id === machineId) ?? null;
  const increment = machine?.increment ?? 5;
  const unit = profile.data?.unit ?? 'lb';
  const [repLow, repHigh] = repRangeOrDefault(
    profile.data?.target_rep_low ?? 6,
    profile.data?.target_rep_high ?? 8,
  );

  const bodyWeight = profile.data?.body_weight ?? null;

  /** Load the user's bodyweight into the weight field (or clear it again). */
  const toggleBodyweight = () => {
    if (isBodyweight) {
      setIsBodyweight(false);
      setWeightTouched(false);
      return;
    }
    if (bodyWeight == null) return;
    setIsBodyweight(true);
    setWeightTouched(true);
    setWeight(bodyWeight);
  };

  const history = useExerciseHistory(exerciseId ?? undefined);

  const priorWorkingForExercise = (existingSets.data ?? []).filter(
    (s) => s.exercise_id === exerciseId && !s.is_warmup,
  ).length;

  const recommendation = useMemo(() => {
    if (!exerciseId || !history.data) return null;
    return recommendNextWeight({
      history: history.data,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      increment,
      currentMachineId: machineId,
      isFirstWorkingSet: priorWorkingForExercise === 0,
    });
  }, [exerciseId, history.data, repLow, repHigh, increment, machineId, priorWorkingForExercise]);

  // Prefill weight from the recommendation until the user edits it themselves.
  const suggested = recommendation?.suggestedWeight ?? null;
  const displayWeight =
    !weightTouched && suggested != null ? suggested : weight;

  const pickExercise = (id: string) => {
    setExerciseId(id);
    setShowExercisePicker(false);
    setWeightTouched(false);
    if (reps === 8) setReps(Math.round((repLow + repHigh) / 2));
  };

  const pickMachine = (id: string) => {
    setMachineId(id);
    setShowMachinePicker(false);
    setWeightTouched(false);
  };

  const canSave = !!exerciseId && displayWeight > 0 && reps > 0 && (isWarmup || rpe != null);

  const save = (thenAddAnother: boolean) => {
    if (!canSave || !workoutId || !exerciseId) return;
    // Synchronous: the set goes into the cache now and reaches the server when
    // there is a connection. Waiting on the network here would leave the button
    // spinning in a gym with no signal, which is where this is used most.
    addSet.add({
      workoutId,
      exerciseId,
      machineId,
      weight: roundToIncrement(displayWeight, increment),
      reps,
      rpe: isWarmup ? null : rpe,
      isWarmup,
      isBodyweight,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      orderIndex: (existingSets.data?.length ?? 0),
    });

    // Rest starts the moment the set is in, not when the user next looks at
    // the screen. Warmups are excluded — nobody rests two minutes after a bar.
    if (profile.data?.rest_auto !== false && !isWarmup) {
      restTimer.start(profile.data?.rest_seconds);
    }

    if (thenAddAnother) {
      setWeightTouched(false);
      setRpe(null);
      setIsWarmup(false);
      setIsBodyweight(false);
      // Not awaited: offline these settle as errors and the cache already has
      // the set, so there is nothing to wait for either way.
      void history.refetch();
    } else {
      router.back();
    }
  };

  const exerciseOptions: Option[] =
    exercises.data?.map((e) => ({ id: e.id, label: e.name, sublabel: e.muscle_group })) ?? [];
  const machineOptions: Option[] =
    machines.data?.map((m) => ({
      id: m.id,
      label: m.label,
      sublabel: `${trimWeight(m.increment)} ${unit} steps`,
    })) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Exercise + machine selectors */}
        <SelectorRow
          label="Exercise"
          value={exercise?.name ?? 'Choose exercise'}
          placeholder={!exercise}
          onPress={() => setShowExercisePicker(true)}
        />
        <SelectorRow
          label="Machine"
          value={machine?.label ?? 'Choose machine (optional)'}
          placeholder={!machine}
          onPress={() => setShowMachinePicker(true)}
        />

        {/* Recommendation */}
        {exerciseId ? (
          <Card title="Suggested next set">
            {history.isLoading ? (
              <Text style={text.bodyMuted}>Loading your history…</Text>
            ) : recommendation?.suggestedWeight != null ? (
              <>
                <Text style={styles.suggestBig}>
                  {trimWeight(recommendation.suggestedWeight)} {unit}
                  <Text style={text.bodyMuted}>
                    {'  '}× {recommendation.repRange[0]}–{recommendation.repRange[1]}
                  </Text>
                </Text>
                <Text style={text.caption}>{recommendation.rationale}</Text>
                <Text style={text.caption}>
                  Working e1RM ≈ {trimWeight(recommendation.e1rm ?? 0)} {unit} ·{' '}
                  {recommendation.confidence} confidence
                </Text>
              </>
            ) : (
              <Text style={text.bodyMuted}>
                No history for this exercise yet — log this set and the next suggestion will use it.
              </Text>
            )}
          </Card>
        ) : null}

        {/* Only on screen once a rest is actually running. */}
        <RestTimerBar hideWhenIdle />

        {/* Inputs */}
        <View>
          <NumberStepper
            label={`Weight (${unit})`}
            value={displayWeight}
            onChange={(n) => {
              setWeightTouched(true);
              setWeight(n);
              setIsBodyweight(false);
            }}
            step={increment}
            precision={1}
            min={0}
          />
          <View style={styles.bwRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isBodyweight, disabled: bodyWeight == null }}
              onPress={toggleBodyweight}
              disabled={bodyWeight == null}
              style={[
                styles.bwBtn,
                isBodyweight && styles.bwBtnActive,
                bodyWeight == null && styles.bwBtnDisabled,
              ]}
            >
              <Text style={[styles.bwText, isBodyweight && styles.bwTextActive]}>BW</Text>
            </Pressable>
            <Text style={[text.caption, styles.bwHint]}>
              {bodyWeight == null
                ? 'Add your bodyweight in Profile to use BW'
                : isBodyweight
                  ? `Using your bodyweight (${trimWeight(bodyWeight)} ${unit})`
                  : `Bodyweight exercise? Tap BW to load ${trimWeight(bodyWeight)} ${unit}`}
            </Text>
          </View>
        </View>

        <NumberStepper label="Reps" value={reps} onChange={setReps} min={1} max={100} />

        <View style={styles.warmupRow}>
          <Text style={text.body}>Warmup set</Text>
          <Switch
            value={isWarmup}
            onValueChange={setIsWarmup}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        {!isWarmup ? <RpeSelector value={rpe} onChange={setRpe} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Save & add another"
          variant="secondary"
          onPress={() => save(true)}
          disabled={!canSave}
          style={styles.footerBtn}
        />
        <Button
          label="Save set"
          onPress={() => save(false)}
          disabled={!canSave}
          style={styles.footerBtn}
        />
      </View>

      <SelectSheet
        visible={showExercisePicker}
        title="Pick an exercise"
        options={exerciseOptions}
        onSelect={pickExercise}
        onClose={() => setShowExercisePicker(false)}
        createLabel="New exercise"
        onCreate={(q) => {
          setPendingName(q);
          setShowExercisePicker(false);
          setShowCreateExercise(true);
        }}
      />
      <SelectSheet
        visible={showMachinePicker}
        title="Pick a machine"
        options={machineOptions}
        onSelect={pickMachine}
        onClose={() => setShowMachinePicker(false)}
        createLabel="New machine"
        onCreate={(q) => {
          setPendingName(q);
          setShowMachinePicker(false);
          setShowCreateMachine(true);
        }}
      />

      <CreateExerciseModal
        visible={showCreateExercise}
        initialName={pendingName}
        busy={createExercise.isPending}
        onClose={() => setShowCreateExercise(false)}
        onSubmit={async (input) => {
          const created = await createExercise.mutateAsync(input);
          setShowCreateExercise(false);
          pickExercise(created.id);
        }}
      />
      <CreateMachineModal
        visible={showCreateMachine}
        initialLabel={pendingName}
        busy={createMachine.isPending}
        onClose={() => setShowCreateMachine(false)}
        onSubmit={async (input) => {
          const created = await createMachine.mutateAsync(input);
          setShowCreateMachine(false);
          pickMachine(created.id);
        }}
      />
    </SafeAreaView>
  );
}

function SelectorRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]} onPress={onPress}>
      <Text style={text.label}>{label.toUpperCase()}</Text>
      <Text style={[text.body, placeholder && { color: colors.textFaint }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  selector: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  selectorPressed: { backgroundColor: colors.border },
  suggestBig: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: { flex: 1 },
  bwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  bwBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  bwBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  bwBtnDisabled: { opacity: 0.4 },
  bwText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  bwTextActive: { color: colors.onPrimary },
  bwHint: { flex: 1 },
});
