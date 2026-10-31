import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useExerciseCalories } from '@/data/activities';
import { nutritionDefaults, useDiaryEntries, useNutritionGoals, useNutritionSettings } from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { diaryDay } from '@/domain/nutrition/diary';
import { todayLocal } from '@/lib/dates';
import { spacing, text } from '@/theme/typography';

import { CalorieSummary } from './CalorieSummary';
import { MacroBars } from './MacroBars';

/**
 * Today's food on the Today tab: the calorie budget and macros, and the way
 * into the diary. Without Pro (once subscriptions are on) it says what the
 * diary is instead, and opens the same place, which offers the plans.
 */
export function NutritionTodayCard() {
  const access = useAccess();
  if (!hasFeature('nutrition', access)) return <LockedCard />;
  return <TodayFood />;
}

function TodayFood() {
  const router = useRouter();
  const today = todayLocal();
  const settings = useNutritionSettings();
  const goals = useNutritionGoals();
  const entries = useDiaryEntries(today);
  const exercise = useExerciseCalories(today);
  const s = settings.data ?? nutritionDefaults();

  const view = diaryDay({
    day: today,
    entries: entries.data ?? [],
    mealNames: s.mealNames,
    goals: goals.data ?? [],
    exerciseKcal: exercise?.totalCalories ?? 0,
    addExercise: s.addExercise,
  });

  return (
    <Card title="Food">
      <CalorieSummary budget={view.budget} unit={s.energyUnit} />
      <MacroBars total={view.total} progress={view.macros} netCarbs={s.netCarbs} />
      <Button
        label={view.isEmpty ? 'Log food' : 'Open food diary'}
        variant="secondary"
        onPress={() => router.push('/nutrition')}
      />
    </Card>
  );
}

function LockedCard() {
  const router = useRouter();
  return (
    <Card title="Food">
      <Text style={text.bodyMuted}>Log meals, scan barcodes and track calories and macros with Rust Strength Pro.</Text>
      <Button label="See the food diary" variant="secondary" onPress={() => router.push('/nutrition')} style={styles.button} />
    </Card>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: spacing.xs },
});
