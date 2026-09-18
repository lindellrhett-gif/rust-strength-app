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
import { keyboardAware } from '@/components/keyboard';
import { useCreateExercise, useExercises } from '@/data/exercises';
import { useCreateMachine, useMachines } from '@/data/machines';
import { useProfile, useUpdateProfile } from '@/data/profile';
import { useAddSet, useExerciseHistory, useSetsForWorkout } from '@/data/sets';
import {
  asLoadType,
  assistProblem,
  assistedLoad,
  bodyweightLoad,
  exerciseSublabel,
} from '@/domain/loadType';
import {
  recommendAssisted,
  recommendNextWeight,
  recommendReps,
  repRangeOrDefault,
} from '@/domain/recommender';
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
  // Assisted exercises: the assistance on the machine.
  const [assist, setAssist] = useState(0);
  const [assistTouched, setAssistTouched] = useState(false);
  // Bodyweight exercises: anything added on top, like a vest or dip belt.
  const [added, setAdded] = useState(0);
  const [addedTouched, setAddedTouched] = useState(false);
  const [reps, setReps] = useState(8);
  const [repsTouched, setRepsTouched] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [isWarmup, setIsWarmup] = useState(false);
  const [isBodyweight, setIsBodyweight] = useState(false);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showMachinePicker, setShowMachinePicker] = useState(false);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [showCreateMachine, setShowCreateMachine] = useState(false);
  const [pendingName, setPendingName] = useState('');

  const exercise = exercises.data?.find((e) => e.id === exerciseId) ?? null;
  const loadType = asLoadType(exercise?.load_type);
  const machine = machines.data?.find((m) => m.id === machineId) ?? null;
  const unit = profile.data?.unit ?? 'lb';
  const increment = machine?.increment ?? 5;
  // Plates and vests come in smaller steps than a weight stack.
  const addedStep = unit === 'kg' ? 2.5 : 5;
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
  const isFirstWorkingSet = priorWorkingForExercise === 0;

  // Bodyweight: start from whatever was added last time (0 if never).
  const lastAdded = useMemo(() => {
    const newest = (history.data ?? []).find((s) => !s.isWarmup && s.addedWeight != null);
    return newest?.addedWeight ?? 0;
  }, [history.data]);
  const displayAdded = addedTouched ? added : lastAdded;

  const weightedRec = useMemo(() => {
    if (!exerciseId || !history.data || loadType !== 'weighted') return null;
    return recommendNextWeight({
      history: history.data,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      increment,
      currentMachineId: machineId,
      isFirstWorkingSet,
    });
  }, [exerciseId, history.data, loadType, repLow, repHigh, increment, machineId, isFirstWorkingSet]);

  const assistedRec = useMemo(() => {
    if (!exerciseId || !history.data || loadType !== 'assisted') return null;
    return recommendAssisted({
      history: history.data,
      bodyWeight: bodyWeight ?? 0,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      increment,
      currentMachineId: machineId,
      isFirstWorkingSet,
    });
  }, [
    exerciseId,
    history.data,
    loadType,
    bodyWeight,
    repLow,
    repHigh,
    increment,
    machineId,
    isFirstWorkingSet,
  ]);

  const repsRec = useMemo(() => {
    if (!exerciseId || !history.data || loadType !== 'bodyweight') return null;
    return recommendReps({
      history: history.data.map((s) => ({
        reps: s.reps,
        rpe: s.rpe,
        isWarmup: s.isWarmup,
        addedWeight: s.addedWeight ?? null,
        performedAt: s.performedAt,
      })),
      addedWeight: displayAdded,
    });
  }, [exerciseId, history.data, loadType, displayAdded]);

  // Each field shows the suggestion until the user edits it themselves.
  const suggestedWeight = weightedRec?.suggestedWeight ?? null;
  const displayWeight = !weightTouched && suggestedWeight != null ? suggestedWeight : weight;
  const suggestedAssist = assistedRec?.suggestedAssist ?? null;
  const displayAssist = !assistTouched && suggestedAssist != null ? suggestedAssist : assist;
  const suggestedReps = repsRec?.suggestedReps ?? null;
  const displayReps =
    loadType === 'bodyweight' && !repsTouched && suggestedReps != null ? suggestedReps : reps;

  const assistError = loadType === 'assisted' ? assistProblem(bodyWeight, displayAssist) : null;

  const resetInputs = () => {
    setWeightTouched(false);
    setAssistTouched(false);
    setAddedTouched(false);
    setRepsTouched(false);
  };

  const pickExercise = (id: string) => {
    setExerciseId(id);
    setShowExercisePicker(false);
    resetInputs();
    setIsBodyweight(false);
    if (reps === 8) setReps(Math.round((repLow + repHigh) / 2));
  };

  const pickMachine = (id: string) => {
    setMachineId(id);
    setShowMachinePicker(false);
    setWeightTouched(false);
    setAssistTouched(false);
  };

  const loadOk =
    loadType === 'weighted'
      ? displayWeight > 0
      : loadType === 'assisted'
        ? assistError == null
        : true;
  const canSave = !!exerciseId && loadOk && displayReps > 0 && (isWarmup || rpe != null);

  const save = (thenAddAnother: boolean) => {
    if (!canSave || !workoutId || !exerciseId) return;

    // `weight` is always the load actually moved, so volume, records and e1RM
    // work the same for every type. What was typed is kept alongside it.
    const load =
      loadType === 'assisted'
        ? {
            weight: assistedLoad(bodyWeight ?? 0, displayAssist),
            isBodyweight: true,
            assistWeight: displayAssist,
            addedWeight: null,
          }
        : loadType === 'bodyweight'
          ? {
              weight: bodyweightLoad(bodyWeight, displayAdded),
              isBodyweight: true,
              assistWeight: null,
              addedWeight: displayAdded,
            }
          : {
              weight: roundToIncrement(displayWeight, increment),
              isBodyweight,
              assistWeight: null,
              addedWeight: null,
            };

    // Synchronous: the set goes into the cache now and reaches the server when
    // there is a connection. Waiting on the network here would leave the button
    // spinning in a gym with no signal, which is where this is used most.
    addSet.add({
      workoutId,
      exerciseId,
      machineId: loadType === 'bodyweight' ? null : machineId,
      ...load,
      reps: displayReps,
      rpe: isWarmup ? null : rpe,
      isWarmup,
      targetRepLow: repLow,
      targetRepHigh: repHigh,
      orderIndex: existingSets.data?.length ?? 0,
    });

    // Rest starts the moment the set is in, not when the user next looks at
    // the screen. Warmups are excluded — nobody rests two minutes after a bar.
    if (profile.data?.rest_auto !== false && !isWarmup) {
      restTimer.start(profile.data?.rest_seconds);
    }

    if (thenAddAnother) {
      resetInputs();
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
    exercises.data?.map((e) => ({
      id: e.id,
      label: e.name,
      sublabel: exerciseSublabel(e.muscle_group, asLoadType(e.load_type)),
    })) ?? [];
  const machineOptions: Option[] =
    machines.data?.map((m) => ({
      id: m.id,
      label: m.label,
      sublabel: `${trimWeight(m.increment)} ${unit} steps`,
    })) ?? [];

  const repsStepper = (
    <NumberStepper
      label="Reps"
      value={displayReps}
      onChange={(n) => {
        setRepsTouched(true);
        setReps(n);
      }}
      min={1}
      max={100}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
        {/* Exercise + machine selectors */}
        <SelectorRow
          label="Exercise"
          value={exercise?.name ?? 'Choose exercise'}
          placeholder={!exercise}
          onPress={() => setShowExercisePicker(true)}
        />
        {/* A pull-up bar has no weight stack, so bodyweight moves skip this. */}
        {loadType !== 'bodyweight' ? (
          <SelectorRow
            label="Machine"
            value={machine?.label ?? 'Choose machine (optional)'}
            placeholder={!machine}
            onPress={() => setShowMachinePicker(true)}
          />
        ) : null}

        {/* Recommendation */}
        {exerciseId ? (
          <Card title="Suggested next set">
            {history.isLoading ? (
              <Text style={text.bodyMuted}>Loading your history…</Text>
            ) : loadType === 'assisted' ? (
              bodyWeight == null ? (
                <BodyweightPrompt unit={unit} />
              ) : assistedRec?.suggestedAssist != null ? (
                <>
                  <Text style={styles.suggestBig}>
                    {trimWeight(assistedRec.suggestedAssist)} {unit} assist
                    <Text style={text.bodyMuted}>
                      {'  '}× {assistedRec.repRange[0]}–{assistedRec.repRange[1]}
                    </Text>
                  </Text>
                  <Text style={text.caption}>{assistedRec.rationale}</Text>
                  <Text style={text.caption}>
                    Moving about {trimWeight(assistedRec.suggestedWeight ?? 0)} {unit}. Less
                    assistance means you are getting stronger.
                  </Text>
                </>
              ) : (
                <Text style={text.bodyMuted}>
                  No history for this exercise yet. Log this set and the next suggestion will use
                  it.
                </Text>
              )
            ) : loadType === 'bodyweight' ? (
              repsRec?.suggestedReps != null ? (
                <>
                  <Text style={styles.suggestBig}>
                    {repsRec.suggestedReps} reps
                    {displayAdded > 0 ? (
                      <Text style={text.bodyMuted}>
                        {'  '}+ {trimWeight(displayAdded)} {unit}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={text.caption}>{repsRec.rationale}</Text>
                  <Text style={text.caption}>
                    Estimated max ≈ {repsRec.estimatedMaxReps} reps · {repsRec.confidence}{' '}
                    confidence
                  </Text>
                </>
              ) : (
                <Text style={text.bodyMuted}>{repsRec?.rationale ?? 'Log a set to get a rep target.'}</Text>
              )
            ) : weightedRec?.suggestedWeight != null ? (
              <>
                <Text style={styles.suggestBig}>
                  {trimWeight(weightedRec.suggestedWeight)} {unit}
                  <Text style={text.bodyMuted}>
                    {'  '}× {weightedRec.repRange[0]}–{weightedRec.repRange[1]}
                  </Text>
                </Text>
                <Text style={text.caption}>{weightedRec.rationale}</Text>
                <Text style={text.caption}>
                  Working e1RM ≈ {trimWeight(weightedRec.e1rm ?? 0)} {unit} ·{' '}
                  {weightedRec.confidence} confidence
                </Text>
              </>
            ) : (
              <Text style={text.bodyMuted}>
                No history for this exercise yet. Log this set and the next suggestion will use it.
              </Text>
            )}
          </Card>
        ) : null}

        {/* Only on screen once a rest is actually running. */}
        <RestTimerBar hideWhenIdle />

        {/* Inputs */}
        {loadType === 'assisted' ? (
          <View>
            <NumberStepper
              label={`Assistance (${unit})`}
              value={displayAssist}
              onChange={(n) => {
                setAssistTouched(true);
                setAssist(n);
              }}
              step={increment}
              precision={1}
              min={0}
              max={bodyWeight ?? undefined}
            />
            <Text style={[text.caption, styles.under]}>
              {assistError && bodyWeight != null
                ? assistError
                : bodyWeight != null
                  ? `Moving ${trimWeight(assistedLoad(bodyWeight, displayAssist))} ${unit}: ${trimWeight(bodyWeight)} bodyweight minus ${trimWeight(displayAssist)} assist.`
                  : 'Set your bodyweight above to log assisted sets.'}
            </Text>
          </View>
        ) : null}

        {loadType === 'bodyweight' ? (
          <>
            {repsStepper}
            <View>
              <NumberStepper
                label={`Added weight (${unit})`}
                value={displayAdded}
                onChange={(n) => {
                  setAddedTouched(true);
                  setAdded(n);
                  // A new added weight has its own rep target.
                  setRepsTouched(false);
                }}
                step={addedStep}
                precision={1}
                min={0}
              />
              <Text style={[text.caption, styles.under]}>
                {bodyWeight == null
                  ? 'Leave at 0 for plain bodyweight. Add your bodyweight in Profile so these sets count toward volume and records.'
                  : 'Leave at 0 for plain bodyweight, or add a vest or dip belt.'}
              </Text>
            </View>
          </>
        ) : null}

        {loadType === 'weighted' ? (
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
        ) : null}

        {loadType !== 'bodyweight' ? repsStepper : null}

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

/**
 * Assisted sets are bodyweight minus assistance, so they cannot be logged
 * without a bodyweight. Asking for it here beats sending someone to Profile
 * mid-set.
 */
function BodyweightPrompt({ unit }: { unit: string }) {
  const update = useUpdateProfile();
  const [value, setValue] = useState(unit === 'kg' ? 75 : 170);
  return (
    <View style={styles.prompt}>
      <Text style={text.body}>Assisted exercises need your bodyweight.</Text>
      <Text style={text.caption}>
        The assistance you set is taken off it to work out what you actually lifted. You can change
        it any time in Profile.
      </Text>
      <NumberStepper
        label={`Bodyweight (${unit})`}
        value={value}
        onChange={setValue}
        step={unit === 'kg' ? 0.5 : 1}
        precision={1}
        min={1}
        max={1000}
      />
      <Button
        label="Save bodyweight"
        onPress={() => update.mutate({ body_weight: value })}
        loading={update.isPending}
      />
    </View>
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
  under: { marginTop: spacing.sm },
  prompt: { gap: spacing.sm },
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
