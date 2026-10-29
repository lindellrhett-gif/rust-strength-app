import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, LoadingView } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { Chips } from '@/components/nutrition/Chips';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { useNutritionGoals, useNutritionSettings, useSaveNutritionSettings } from '@/data/nutrition';
import { useProfile } from '@/data/profile';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { formatWater, parseWater, suggestedWaterGoalMl, waterIn, waterUnitFor, type WeightUnit } from '@/domain/nutrition/body';
import { MAX_MEALS } from '@/domain/nutrition/entries';
import { cleanMealNames, MEAL_NAME_MAX, type NutritionSettings } from '@/domain/nutrition/settings';
import { goalFor } from '@/domain/nutrition/totals';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** The database's bounds for a water goal. */
const WATER_GOAL_ML = { min: 250, max: 10_000 };

/**
 * The diary's settings: meal names, kcal or kJ, whether exercise adds to the
 * budget, net carbs, and a water goal. Switches save as they change; the
 * typed ones save with the button.
 */
export default function NutritionSettingsScreen() {
  const access = useAccess();
  const settings = useNutritionSettings();
  const profile = useProfile();
  if (!hasFeature('nutrition', access)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <NutritionLocked />
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (!settings.data || profile.isLoading) return <LoadingView />;
  return <SettingsForm settings={settings.data} unit={profile.data?.unit ?? 'lb'} />;
}

function SettingsForm({ settings, unit }: { settings: NutritionSettings; unit: WeightUnit }) {
  const save = useSaveNutritionSettings();
  const goals = useNutritionGoals();
  const [meals, setMeals] = useState<string[]>(settings.mealNames);
  const [water, setWater] = useState(settings.waterGoalMl != null ? String(waterIn(settings.waterGoalMl, unit)) : '');
  const [problem, setProblem] = useState<{ meals?: string; water?: string }>({});

  const waterUnit = waterUnitFor(unit) === 'floz' ? 'fl oz' : 'ml';
  const savedWater = settings.waterGoalMl != null ? String(waterIn(settings.waterGoalMl, unit)) : '';
  const changed = meals.join('\n') !== settings.mealNames.join('\n') || water.trim() !== savedWater;
  const goal = goalFor(goals.data ?? [], todayLocal());
  const cleaned = cleanMealNames(meals);
  const splitStale = goal?.mealSplit != null && goal.mealSplit.length !== meals.length;

  const saveNow = (changes: Partial<NutritionSettings>) =>
    save.mutate(changes, {
      onError: (e) => Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Check your connection and try again.'),
    });

  const submit = () => {
    const next: { meals?: string; water?: string } = {};
    // A blank name is a problem, not a meal to drop: dropping one would move later meals' food.
    if (!cleaned || cleaned.length !== meals.length) next.meals = `Give each meal a name, up to ${MEAL_NAME_MAX} characters.`;
    let waterMl: number | null = null;
    if (water.trim() !== '') {
      waterMl = parseWater(water, unit);
      if (waterMl == null || waterMl < WATER_GOAL_ML.min || waterMl > WATER_GOAL_ML.max) {
        next.water = `Enter ${formatWater(WATER_GOAL_ML.min, unit)} to ${formatWater(WATER_GOAL_ML.max, unit)}, or leave it blank.`;
      }
    }
    setProblem(next);
    if (next.meals || next.water || !cleaned) return;
    setMeals(cleaned);
    setWater(waterMl != null ? String(waterIn(waterMl, unit)) : '');
    saveNow({ mealNames: cleaned, waterGoalMl: waterMl });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        <Card title="Meals">
          {meals.map((name, i) => (
            <View key={i} style={styles.mealRow}>
              <TextInput
                value={name}
                onChangeText={(v) => setMeals(meals.map((m, j) => (j === i ? v : m)))}
                placeholder={`Meal ${i + 1}`}
                placeholderTextColor={colors.textFaint}
                maxLength={MEAL_NAME_MAX}
                style={styles.input}
                accessibilityLabel={`Meal ${i + 1} name`}
              />
              {/* Entries keep their meal's position, so only the last meal can go:
                  removing one in the middle would move every later meal's food under a new name. */}
              {meals.length > 1 && i === meals.length - 1 ? (
                <Pressable
                  onPress={() => setMeals(meals.slice(0, -1))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name || `meal ${i + 1}`}`}
                >
                  <Text style={styles.quiet}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {problem.meals ? <Text style={styles.error}>{problem.meals}</Text> : null}
          {meals.length < MAX_MEALS ? (
            <Pressable onPress={() => setMeals([...meals, ''])} hitSlop={8} accessibilityRole="button" style={styles.add}>
              <Text style={styles.link}>Add a meal</Text>
            </Pressable>
          ) : null}
          <Text style={text.caption}>
            Up to {MAX_MEALS}. A new name shows on every day, past ones too. Food logged in a meal you remove
            stays in the diary, under its number.
          </Text>
          {splitStale ? (
            <Text style={styles.warning}>
              Your goal splits calories across {goal?.mealSplit?.length} meals. Set the split again in Goals after saving.
            </Text>
          ) : null}
        </Card>

        <Card title="Water">
          <Field
            label={`Daily goal (${waterUnit}, optional)`}
            value={water}
            onChangeText={setWater}
            keyboardType="decimal-pad"
            placeholder={String(waterIn(suggestedWaterGoalMl(unit), unit))}
            error={problem.water}
          />
        </Card>

        {changed ? <Button label="Save changes" size="lg" onPress={submit} loading={save.isPending} /> : null}

        <Card title="Energy">
          <Chips
            options={[
              { key: 'kcal', label: 'Calories (kcal)' },
              { key: 'kj', label: 'Kilojoules (kJ)' },
            ]}
            selected={settings.energyUnit}
            onSelect={(energyUnit) => saveNow({ energyUnit })}
            accessibilityLabel="Energy unit"
          />
        </Card>

        <Card title="Diary">
          <Row
            label="Add exercise to the budget"
            caption="Runs and other activities you log raise the day’s calories. The burn is an estimate. Lifting sessions have no estimate yet, so they add nothing."
            value={settings.addExercise}
            onChange={(addExercise) => saveNow({ addExercise })}
          />
          <Row
            label="Net carbs"
            caption="Show carbohydrate minus fiber."
            value={settings.netCarbs}
            onChange={(netCarbs) => saveNow({ netCarbs })}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, caption, value, onChange }: { label: string; caption: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={text.body}>{label}</Text>
        <Text style={text.caption}>{caption}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  add: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  flex: { flex: 1 },
  quiet: { color: colors.textMuted, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.danger },
  warning: { color: colors.warning },
});
