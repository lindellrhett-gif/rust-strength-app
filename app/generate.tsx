import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView } from '@/components';
import { NumberStepper } from '@/components/NumberStepper';
import { useExercises } from '@/data/exercises';
import { useProfile } from '@/data/profile';
import { useRecentHistoryByExercise } from '@/data/sets';
import { useWeeklyCoverage } from '@/data/stats';
import { SaveTemplateModal } from '@/components/SaveTemplateModal';
import { useAddWorkoutExercises, useSaveTemplate } from '@/data/templates';
import { useStartWorkout } from '@/data/workouts';
import {
  EQUIPMENT_OPTIONS,
  FOCUS_GROUPS,
  generateWorkout,
  type Equipment,
  type Focus,
  type GeneratorExercise,
} from '@/domain/generator';
import { repRangeOrDefault } from '@/domain/recommender';
import { weekStart } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { trimWeight } from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const FOCUS_LABELS: Record<Focus, string> = {
  'full-body': 'Full body',
  upper: 'Upper',
  lower: 'Lower',
  push: 'Push',
  pull: 'Pull',
};

export default function GenerateWorkout() {
  const router = useRouter();
  const profile = useProfile();
  const exercises = useExercises();
  const history = useRecentHistoryByExercise();
  const coverage = useWeeklyCoverage(weekStart(todayLocal()));
  const startWorkout = useStartWorkout();
  const addSlots = useAddWorkoutExercises();
  const saveTemplate = useSaveTemplate();
  const [showSavePreset, setShowSavePreset] = useState(false);

  const [focus, setFocus] = useState<Focus>('full-body');
  const [count, setCount] = useState(5);
  const [setsPer, setSetsPer] = useState(3);
  const [seed, setSeed] = useState(1);
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);

  const unit = profile.data?.unit ?? 'lb';
  // Default to the equipment saved on the profile until the user overrides it.
  const profileEquipment = profile.data?.equipment;
  const selectedEquipment = useMemo(
    () => equipment ?? ((profileEquipment ?? []) as Equipment[]),
    [equipment, profileEquipment],
  );

  const generatorExercises: GeneratorExercise[] = useMemo(
    () =>
      (exercises.data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscle_group,
        equipment: (e.equipment ?? null) as Equipment | null,
      })),
    [exercises.data],
  );

  const [repLow, repHigh] = repRangeOrDefault(
    profile.data?.target_rep_low ?? 6,
    profile.data?.target_rep_high ?? 8,
  );

  const plan = useMemo(
    () =>
      generateWorkout({
        exercises: generatorExercises,
        availableEquipment: selectedEquipment,
        focus,
        exerciseCount: count,
        setsPerExercise: setsPer,
        targetRepLow: repLow,
        targetRepHigh: repHigh,
        weekCoverage: coverage.data ?? {},
        historyByExercise: history.data ?? {},
        seed,
      }),
    [
      generatorExercises,
      selectedEquipment,
      focus,
      count,
      setsPer,
      repLow,
      repHigh,
      coverage.data,
      history.data,
      seed,
    ],
  );

  const toggleEquipment = (kind: Equipment) => {
    const base = selectedEquipment;
    setEquipment(base.includes(kind) ? base.filter((e) => e !== kind) : [...base, kind]);
  };

  const startFromPlan = async () => {
    if (plan.items.length === 0) return;
    // Name it after the focus so the Recent feed reads "Push day", not "Workout".
    const workout = await startWorkout.mutateAsync({ name: `${FOCUS_LABELS[focus]} day` });
    // Write the plan onto the session so every exercise is already there and
    // the user only has to fill in weights.
    await addSlots.mutateAsync({
      workoutId: workout.id,
      slots: plan.items.map((item) => ({
        exerciseId: item.exerciseId,
        targetSets: item.sets,
        targetRepLow: item.repLow,
        targetRepHigh: item.repHigh,
        suggestedWeight: item.suggestedWeight,
      })),
    });
    router.replace(`/workout/${workout.id}`);
  };

  // Alert.prompt is iOS-only, so preset naming goes through a real modal.
  const savePlanAsPreset = async (name: string) => {
    try {
      await saveTemplate.mutateAsync({
        name,
        items: plan.items.map((item) => ({
          exerciseId: item.exerciseId,
          exerciseName: item.exerciseName,
          targetSets: item.sets,
          targetRepLow: item.repLow,
          targetRepHigh: item.repHigh,
        })),
      });
      setShowSavePreset(false);
      Alert.alert('Preset saved', `"${name}" is ready to plan or start from.`);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (exercises.isLoading || profile.isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="What are you training?">
          <View style={styles.chips}>
            {(Object.keys(FOCUS_LABELS) as Focus[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFocus(f)}
                style={[styles.chip, focus === f && styles.chipActive]}
              >
                <Text style={[styles.chipText, focus === f && styles.chipTextActive]}>
                  {FOCUS_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={text.caption}>
            {FOCUS_GROUPS[focus].join(' · ')}
          </Text>
        </Card>

        <Card title="What do you have to work with?">
          <View style={styles.chips}>
            {EQUIPMENT_OPTIONS.map((kind) => {
              const on = selectedEquipment.includes(kind);
              return (
                <Pressable
                  key={kind}
                  onPress={() => toggleEquipment(kind)}
                  style={[styles.chip, on && styles.chipActive]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{kind}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={text.caption}>
            {selectedEquipment.length === 0
              ? 'Nothing selected — everything is fair game.'
              : 'Only exercises using this equipment will be picked.'}
          </Text>
        </Card>

        <Card title="Size">
          <NumberStepper label="Exercises" value={count} onChange={setCount} min={1} max={12} />
          <NumberStepper label="Sets each" value={setsPer} onChange={setSetsPer} min={1} max={10} />
        </Card>

        <Card title="Your workout">
          {plan.warning ? <Text style={styles.warning}>{plan.warning}</Text> : null}

          {plan.items.map((item, i) => (
            <View key={item.exerciseId} style={styles.item}>
              <View style={styles.itemHead}>
                <Text style={text.body}>
                  {i + 1}. {item.exerciseName}
                </Text>
                <Text style={styles.itemPrescription}>
                  {item.sets} × {item.repLow}–{item.repHigh}
                </Text>
              </View>
              <Text style={text.caption}>
                {item.suggestedWeight != null
                  ? `Start around ${trimWeight(item.suggestedWeight)} ${unit} · `
                  : ''}
                {item.reason}
              </Text>
            </View>
          ))}

          <View style={styles.actions}>
            <Button
              label="Shuffle"
              variant="secondary"
              onPress={() => setSeed((s) => s + 1)}
              style={styles.actionBtn}
            />
            <Button
              label="Save as preset"
              variant="secondary"
              onPress={() => setShowSavePreset(true)}
              disabled={plan.items.length === 0}
              style={styles.actionBtn}
            />
          </View>
          <Button
            label="Start this workout"
            size="lg"
            onPress={startFromPlan}
            disabled={plan.items.length === 0}
            loading={startWorkout.isPending || addSlots.isPending}
          />
        </Card>
      </ScrollView>

      <SaveTemplateModal
        visible={showSavePreset}
        busy={saveTemplate.isPending}
        initialName={`${FOCUS_LABELS[focus]} day`}
        exerciseNames={plan.items.map((i) => i.exerciseName)}
        onClose={() => setShowSavePreset(false)}
        onSubmit={savePlanAsPreset}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.onPrimary },
  warning: { color: colors.warning, fontSize: 13 },
  item: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemPrescription: { color: colors.primary, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
});
