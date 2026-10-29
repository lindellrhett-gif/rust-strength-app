import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, LoadingView } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { Chips } from '@/components/nutrition/Chips';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import {
  useCurrentWeight,
  useNutritionGoals,
  useNutritionSettings,
  useSaveNutritionGoal,
  useSaveNutritionSettings,
  useSaveWeighIn,
} from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { energyUnitLabel, formatEnergy } from '@/domain/nutrition/diary';
import {
  draftFor,
  evaluateGoal,
  RATE_OPTIONS,
  type GoalContext,
  type GoalDirection,
  type GoalDraft,
  type GoalField,
} from '@/domain/nutrition/goalForm';
import { ACTIVITY_LABELS, type ActivityLevel } from '@/domain/nutrition/goals';
import { NUTRIENT_LABELS } from '@/domain/nutrition/nutrients';
import type { NutritionSettings } from '@/domain/nutrition/settings';
import { DAILY_VALUES, LIMIT_KEYS, TARGET_KEYS, type TargetKey } from '@/domain/nutrition/targets';
import { goalFor, type NutritionGoal } from '@/domain/nutrition/totals';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const ACTIVITY_OPTIONS = (Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => ({ key, label: ACTIVITY_LABELS[key] }));

/** Problems worth showing as soon as they arise; the rest wait for Save, so a half-typed form isn't red. */
const LIVE: ReadonlySet<GoalField> = new Set<GoalField>(['direction', 'macros', 'mealSplit']);

/**
 * Set the calorie goal (from the calculator or a number of your own), the
 * macros, other nutrient targets and an optional split by meal. A saved goal
 * starts today; earlier days keep the goal they had.
 */
export default function GoalsScreen() {
  const access = useAccess();
  const settings = useNutritionSettings();
  const goals = useNutritionGoals();
  const body = useCurrentWeight();
  if (!hasFeature('nutrition', access)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <NutritionLocked />
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (!settings.data || !goals.data || body.isLoading) {
    if (settings.isFetching || goals.isFetching || body.isLoading) return <LoadingView />;
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Text style={text.bodyMuted}>Your goals need a connection to load. Try again in a moment.</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <GoalForm
      settings={settings.data}
      goals={goals.data}
      weightUnit={body.weightUnit}
      currentWeightKg={body.currentWeightKg}
    />
  );
}

function GoalForm({
  settings,
  goals,
  weightUnit,
  currentWeightKg,
}: {
  settings: NutritionSettings;
  goals: NutritionGoal[];
  weightUnit: 'lb' | 'kg';
  currentWeightKg: number | null;
}) {
  const router = useRouter();
  const today = todayLocal();
  const ctx: GoalContext = {
    weightUnit,
    energyUnit: settings.energyUnit,
    today,
    mealNames: settings.mealNames,
    currentWeightKg,
  };
  const current = goalFor(goals, today);
  const [draft, setDraft] = useState<GoalDraft>(() => draftFor(settings, current, ctx));
  const [submitted, setSubmitted] = useState(false);
  const [showTargets, setShowTargets] = useState(() => TARGET_KEYS.some((k) => current?.targets[k] != null));
  const saveGoal = useSaveNutritionGoal();
  const saveSettings = useSaveNutritionSettings();
  const { save: saveWeighIn } = useSaveWeighIn();

  const ev = evaluateGoal(draft, ctx);
  const set = (changes: Partial<GoalDraft>) => setDraft((d) => ({ ...d, ...changes }));
  const problem = (field: GoalField) => {
    const p = ev.problems.find((x) => x.field === field);
    return p && (submitted || LIVE.has(field)) ? p.message : undefined;
  };
  const energy = (kcal: number) => `${formatEnergy(kcal, settings.energyUnit)} ${energyUnitLabel(settings.energyUnit)}`;
  const calculator = draft.calories === 'calculator';
  const directions: { key: GoalDirection; label: string }[] = [
    ...(ev.minor ? [] : [{ key: 'lose' as const, label: 'Lose' }]),
    { key: 'maintain', label: 'Maintain' },
    { key: 'gain', label: 'Gain' },
  ];

  const doSave = async () => {
    const result = ev.result;
    if (!result) return;
    try {
      // The inputs first, so a goal that fails to save is what the message reports.
      await saveSettings.mutateAsync(result.settings);
      await saveGoal.mutateAsync({ goal: result.goal, macroMode: result.macroMode });
      if (result.weighInKg != null) saveWeighIn(today, result.weighInKg);
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t save the goal', e instanceof Error ? e.message : 'Check your connection and try again.');
    }
  };

  const submit = () => {
    setSubmitted(true);
    if (!ev.result) return;
    if (ev.belowFloor) {
      Alert.alert(
        `Under ${energy(ev.floor)} a day`,
        'Check with a doctor or dietitian before eating this little. Save it anyway?',
        [
          { text: 'Change it', style: 'cancel' },
          { text: 'Save', onPress: () => void doSave() },
        ],
      );
      return;
    }
    void doSave();
  };

  const fillDailyValues = () =>
    setDraft((d) => {
      const targets = { ...d.targets };
      for (const [key, value] of Object.entries(DAILY_VALUES) as [TargetKey, number][]) targets[key] = String(value);
      return { ...d, targets };
    });

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        <Card title="Calories">
          <Chips
            options={[
              { key: 'calculator', label: 'Work it out' },
              { key: 'manual', label: 'Set my own' },
            ]}
            selected={draft.calories}
            onSelect={(calories) => set({ calories })}
            accessibilityLabel="How to set calories"
          />

          {calculator ? (
            <>
              <Field
                label={`Weight today (${weightUnit})`}
                value={draft.weight}
                onChangeText={(weight) => set({ weight })}
                keyboardType="decimal-pad"
                error={problem('weight')}
              />
              {weightUnit === 'lb' ? (
                <View style={styles.pair}>
                  <View style={styles.flex}>
                    <Field
                      label="Height (ft)"
                      value={draft.heightFt}
                      onChangeText={(heightFt) => set({ heightFt })}
                      keyboardType="number-pad"
                      error={problem('height')}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Field label="(in)" value={draft.heightIn} onChangeText={(heightIn) => set({ heightIn })} keyboardType="decimal-pad" />
                  </View>
                </View>
              ) : (
                <Field
                  label="Height (cm)"
                  value={draft.heightCm}
                  onChangeText={(heightCm) => set({ heightCm })}
                  keyboardType="decimal-pad"
                  error={problem('height')}
                />
              )}
            </>
          ) : (
            <Field
              label={`${settings.energyUnit === 'kj' ? 'Kilojoules' : 'Calories'} a day (${energyUnitLabel(settings.energyUnit)})`}
              value={draft.manualEnergy}
              onChangeText={(manualEnergy) => set({ manualEnergy })}
              keyboardType="number-pad"
              error={problem('manualEnergy')}
            />
          )}

          <Field
            label="Birth year"
            value={draft.birthYear}
            onChangeText={(birthYear) => set({ birthYear })}
            keyboardType="number-pad"
            maxLength={4}
            error={problem('birthYear')}
          />
          <Text style={text.caption}>
            {calculator ? 'Age is part of the estimate. ' : ''}Weight-loss goals are for adults, so the age decides which goals are
            offered.
          </Text>
          {ev.minor && !calculator ? (
            <Text style={styles.warning}>Under 18, the goal comes from the calculator, to maintain or gain.</Text>
          ) : null}

          {calculator ? (
            <>
              <Text style={text.label}>SEX, FOR THE EQUATION</Text>
              <Chips
                options={[
                  { key: 'female', label: 'Female' },
                  { key: 'male', label: 'Male' },
                  { key: 'none', label: 'Leave out' },
                ]}
                selected={draft.sex ?? 'none'}
                onSelect={(sex) => set({ sex: sex === 'none' ? null : sex })}
                accessibilityLabel="Sex, for the equation"
              />
              <Text style={text.caption}>The equation differs for women and men. Left out, it uses the value halfway between.</Text>

              <Text style={text.label}>YOUR DAYS</Text>
              <Chips
                options={ACTIVITY_OPTIONS}
                selected={draft.activity}
                onSelect={(activity) => set({ activity })}
                accessibilityLabel="How active your days are"
              />
              {problem('activity') ? <Text style={styles.error}>{problem('activity')}</Text> : null}
              <Text style={text.caption}>
                Everyday activity, not workouts.{' '}
                {settings.addExercise
                  ? 'Exercise you log is added on the day it happens.'
                  : 'Exercise you log isn’t added to the budget (a diary setting).'}
              </Text>

              <Text style={text.label}>GOAL</Text>
              <Chips options={directions} selected={draft.direction} onSelect={(direction) => set({ direction })} accessibilityLabel="Goal" />
              {ev.minor ? <Text style={text.caption}>Weight-loss goals are for adults, so they aren’t offered under 18.</Text> : null}
              {draft.direction !== 'maintain' ? (
                <Chips
                  options={RATE_OPTIONS[weightUnit].map((r) => ({ key: r.kg, label: `${r.label} a week` }))}
                  selected={draft.rateKg}
                  onSelect={(rateKg) => set({ rateKg })}
                  accessibilityLabel="Weekly change"
                />
              ) : null}
              {problem('direction') ? <Text style={styles.error}>{problem('direction')}</Text> : null}
            </>
          ) : null}

          <Field
            label={`Goal weight (${weightUnit}, optional)`}
            value={draft.goalWeight}
            onChangeText={(goalWeight) => set({ goalWeight })}
            keyboardType="decimal-pad"
            error={problem('goalWeight')}
          />

          {calculator && ev.calc ? (
            <View style={styles.result} accessible>
              <Text style={text.bodyMuted}>About {energy(ev.calc.maintenance)} a day keeps your weight where it is.</Text>
              <Text style={styles.resultBig}>{energy(ev.calc.kcal)} a day</Text>
              <Text style={text.caption}>
                An estimate from the Mifflin-St Jeor equation. How your weight moves over a few weeks tells you more; adjust
                from there.
              </Text>
            </View>
          ) : null}
          {ev.belowFloor ? (
            <Text style={styles.warning}>
              That’s under {energy(ev.floor)} a day. Check with a doctor or dietitian before eating this little.
            </Text>
          ) : null}
        </Card>

        <Card title="Macros">
          <Chips
            options={[
              { key: 'percent', label: 'Percent of calories' },
              { key: 'grams', label: 'Grams' },
            ]}
            selected={draft.macroMode}
            onSelect={(macroMode) => set({ macroMode })}
            accessibilityLabel="How to set macros"
          />
          <View style={styles.pair}>
            {(
              [
                ['carbs', 'Carbs'],
                ['protein', 'Protein'],
                ['fat', 'Fat'],
              ] as const
            ).map(([key, label]) => {
              const field = draft.macroMode === 'percent' ? (`${key}Pct` as const) : (`${key}G` as const);
              const grams = ev.macros?.[`${key}G`];
              return (
                <View key={key} style={styles.flex}>
                  <Field
                    label={`${label} (${draft.macroMode === 'percent' ? '%' : 'g'})`}
                    value={draft[field]}
                    onChangeText={(v) => set({ [field]: v })}
                    keyboardType={draft.macroMode === 'percent' ? 'number-pad' : 'decimal-pad'}
                  />
                  {draft.macroMode === 'percent' && grams != null ? <Text style={text.caption}>{grams} g</Text> : null}
                </View>
              );
            })}
          </View>
          {problem('macros') ? (
            <Text style={styles.error}>{problem('macros')}</Text>
          ) : draft.macroMode === 'grams' && ev.macroKcal != null && ev.kcal != null ? (
            <Text style={text.caption}>
              These add up to {energy(ev.macroKcal)}; the goal is {energy(ev.kcal)}.
            </Text>
          ) : null}
        </Card>

        <Card title="Other targets">
          <Text style={text.caption}>
            Optional. Saturated fat, sodium, sugars and cholesterol are limits to stay under; the rest are amounts to reach.
          </Text>
          {showTargets ? (
            <>
              <Button label="Fill in the label Daily Values" variant="secondary" onPress={fillDailyValues} />
              <Text style={text.caption}>The Daily Values on US food labels, set by the FDA for a 2,000-calorie diet.</Text>
              {TARGET_KEYS.map((key) => (
                <Field
                  key={key}
                  label={`${NUTRIENT_LABELS[key].label} (${NUTRIENT_LABELS[key].unit})${LIMIT_KEYS.has(key) ? ', limit' : ''}`}
                  value={draft.targets[key] ?? ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, targets: { ...d.targets, [key]: v } }))}
                  keyboardType="decimal-pad"
                  error={problem(key)}
                />
              ))}
            </>
          ) : (
            <Button label="Set other targets" variant="secondary" onPress={() => setShowTargets(true)} />
          )}
        </Card>

        <Card title="Calories by meal">
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={text.body}>Split by meal</Text>
              <Text style={text.caption}>Each meal gets a share of the day, shown beside its total.</Text>
            </View>
            <Switch
              value={draft.splitByMeal}
              onValueChange={(splitByMeal) => set({ splitByMeal })}
              accessibilityLabel="Split calories by meal"
            />
          </View>
          {draft.splitByMeal
            ? settings.mealNames.map((name, i) => {
                const share = Number(draft.mealSplit[i]);
                return (
                  <View key={i} style={styles.mealRow}>
                    <Text style={[text.body, styles.flex]} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={styles.pct}>
                      <Field
                        label="%"
                        value={draft.mealSplit[i] ?? ''}
                        onChangeText={(v) => setDraft((d) => ({ ...d, mealSplit: d.mealSplit.map((x, j) => (j === i ? v : x)) }))}
                        keyboardType="number-pad"
                        maxLength={3}
                        accessibilityLabel={`${name}, percent of the day`}
                      />
                    </View>
                    <Text style={[text.caption, styles.share]}>
                      {ev.kcal != null && Number.isFinite(share) ? energy(Math.round((ev.kcal * share) / 100)) : ''}
                    </Text>
                  </View>
                );
              })
            : null}
          {draft.splitByMeal && problem('mealSplit') ? <Text style={styles.error}>{problem('mealSplit')}</Text> : null}
        </Card>

        {submitted && ev.problems.length > 0 ? <Text style={styles.error}>Fix the fields marked above.</Text> : null}
        <Text style={text.caption}>
          The goal starts today. Earlier days keep the goal they had.
          {calculator ? ' A changed weight is saved as today’s weigh-in.' : ''}
        </Text>
        <Button label="Save goal" size="lg" onPress={submit} loading={saveGoal.isPending || saveSettings.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  pair: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  result: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resultBig: { fontSize: 24, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mealRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  pct: { width: 80 },
  share: { width: 90, textAlign: 'right', paddingBottom: spacing.md },
  error: { color: colors.danger },
  warning: { color: colors.warning },
});
