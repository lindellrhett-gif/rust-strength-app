import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { StatTile } from './index';
import { StepGoalSheet } from './StepGoalSheet';
import { GlyphIcon } from './TrophyIcon';
import { useExerciseCalories } from '@/data/activities';
import { nutritionDefaults, useDiaryEntries, useNutritionGoals, useNutritionSettings } from '@/data/nutrition';
import { useStepGoal } from '@/data/stepGoal';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { diaryDay } from '@/domain/nutrition/diary';
import {
  calorieTile,
  cleanStepGoal,
  consistencyPercent,
  stepGoalShort,
  stepProgress,
} from '@/domain/todayTiles';
import { todayLocal } from '@/lib/dates';
import { useStepsToday } from '@/lib/useStepsToday';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

/**
 * The four tiles at the top of Today: consistency over the last 30 days,
 * steps against the daily goal, calories left and the streak.
 */
export function TodayTiles({ consistency, streak }: { consistency: number; streak: number }) {
  return (
    <View style={styles.tiles}>
      <StatTile value={consistencyPercent(consistency)} label="consistency, 30 days" />
      <StepsTile />
      <CaloriesTile />
      <StatTile
        value={String(streak)}
        label="day streak"
        icon={<GlyphIcon glyph="flame" color={colors.warning} size={26} />}
        accessibilityLabel={`${streak}-day streak`}
      />
    </View>
  );
}

/**
 * Today's steps out of the goal; tap to change the goal. Until steps are
 * turned on it offers to turn them on instead. The count is read on the
 * phone and never uploaded (src/lib/steps.ts).
 */
function StepsTile() {
  const { access, steps, request } = useStepsToday();
  const goal = useStepGoal().data ?? cleanStepGoal(null);
  const [editing, setEditing] = useState(false);

  if (access === 'undetermined') {
    return <StatTile value="Turn on" label="steps today" onPress={() => void request()} accessibilityLabel="Turn on steps" />;
  }
  if (access === 'denied') {
    const explain = () =>
      Alert.alert('Steps are off', 'Allow Motion & Fitness for Rust Strength in Settings to see today’s steps.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    return <StatTile value="Off" label="steps today" onPress={explain} accessibilityLabel="Steps are off" />;
  }
  if (access !== 'granted' || steps == null) {
    // Still checking, or a phone that can't count steps.
    return <StatTile value="—" label="steps today" />;
  }

  const progress = stepProgress(steps, goal);
  return (
    <>
      <StatTile
        value={steps.toLocaleString('en-US')}
        suffix={` / ${stepGoalShort(goal)}`}
        label="steps today"
        onPress={() => setEditing(true)}
        accessibilityLabel={`${steps.toLocaleString('en-US')} of ${goal.toLocaleString('en-US')} steps today. Change the goal.`}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </StatTile>
      <StepGoalSheet visible={editing} onClose={() => setEditing(false)} />
    </>
  );
}

/** What's left of today's calorie goal; opens the Food tab. Pro only once subscriptions are on. */
function CaloriesTile() {
  const router = useRouter();
  const access = useAccess();
  const openFood = () => router.navigate('/(tabs)/food');
  if (!hasFeature('nutrition', access)) {
    return <StatTile value="Pro" label="food diary" valueColor={colors.primary} onPress={openFood} />;
  }
  return <CaloriesLeft onPress={openFood} />;
}

function CaloriesLeft({ onPress }: { onPress: () => void }) {
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
  const tile = calorieTile(view.budget, s.energyUnit);
  return (
    <StatTile
      value={tile.value}
      label={tile.label}
      valueColor={tile.over ? colors.danger : undefined}
      onPress={onPress}
      accessibilityLabel={`${tile.value} ${tile.label}. Open the food diary.`}
    />
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
});
