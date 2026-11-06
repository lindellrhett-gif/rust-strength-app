import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { Chips } from '@/components/nutrition/Chips';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { nutritionDefaults, useLogEntries, useNutritionSettings } from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { mealNamesFor, parseOptionalNumber } from '@/domain/nutrition/diary';
import { MAX_MEALS, quickAddEntry } from '@/domain/nutrition/entries';
import { todayLocal } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Calories, and macros if you know them, with no food behind them. */
export default function QuickAddScreen() {
  const access = useAccess();
  if (!hasFeature('nutrition', access)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <NutritionLocked />
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <QuickAdd />;
}

function QuickAdd() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; meal?: string }>();
  const day = params.day && DAY_RE.test(params.day) ? params.day : todayLocal();
  const mealParam = Number(params.meal);
  const settings = useNutritionSettings();
  const s = settings.data ?? nutritionDefaults();
  const [meal, setMeal] = useState(Number.isInteger(mealParam) && mealParam >= 0 && mealParam < MAX_MEALS ? mealParam : 0);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const { log } = useLogEntries();

  const values = [parseOptionalNumber(kcal), parseOptionalNumber(protein), parseOptionalNumber(carbs), parseOptionalNumber(fat)];
  const invalid = values.some((v) => Number.isNaN(v));
  const entry =
    !invalid && values[0] != null
      ? quickAddEntry(
          { kcal: values[0], proteinG: values[1], carbsG: values[2], fatG: values[3], name },
          { id: 'preview', day, meal, loggedAt: '' },
        )
      : null;

  const save = () => {
    if (!entry) return;
    log([{ ...entry, id: newId(), loggedAt: new Date().toISOString() }]);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        <Field label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" autoFocus placeholder="Required" />
        <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="Optional" />
        <Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="Optional" />
        <Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="Optional" />
        <Field label="Name" value={name} onChangeText={setName} placeholder="Quick add" maxLength={200} />
        <Text style={text.label}>MEAL</Text>
        <Chips options={mealNamesFor(s.mealNames, meal).map((m, i) => ({ key: i, label: m }))} selected={meal} onSelect={setMeal} />
        {invalid ? <Text style={styles.error}>Numbers only, zero or more.</Text> : null}
        <Button label="Add" size="lg" disabled={!entry} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  error: { color: colors.danger },
});
