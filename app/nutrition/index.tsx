import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { CalorieSummary } from '@/components/nutrition/CalorieSummary';
import { EntrySheet } from '@/components/nutrition/EntrySheet';
import { MacroBars } from '@/components/nutrition/MacroBars';
import { MealSection } from '@/components/nutrition/MealSection';
import { NutrientsCard } from '@/components/nutrition/NutrientsCard';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { WaterCard } from '@/components/nutrition/WaterCard';
import { useExerciseCalories } from '@/data/activities';
import {
  useDeleteEntry,
  useDiaryDay,
  useDiaryEntries,
  useLogEntries,
  useNutritionGoals,
  useNutritionSettings,
  useSaveDiaryDay,
  useSaveMeal,
  useUpdateEntry,
} from '@/data/nutrition';
import { useProfile } from '@/data/profile';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { dayLabel, diaryDay, energyUnitLabel, formatEnergy } from '@/domain/nutrition/diary';
import { copyEntries, type DiaryEntry } from '@/domain/nutrition/entries';
import { cleanMealName, itemsFromEntries } from '@/domain/nutrition/savedMeals';
import { DEFAULT_NUTRITION_SETTINGS } from '@/domain/nutrition/settings';
import { addDays } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "Yesterday" reads as "yesterday" mid-sentence; a date stays as it is. */
function inSentence(label: string): string {
  return ['Today', 'Yesterday', 'Tomorrow'].includes(label) ? label.toLowerCase() : label;
}

/**
 * The food diary for one day: Goal - Food + Exercise = Remaining, the macros,
 * each meal with its foods, the day's exercise, and a note. Opens on today, or
 * on the day passed as `?day=YYYY-MM-DD`.
 */
export default function FoodDiary() {
  const access = useAccess();
  if (!hasFeature('nutrition', access)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <NutritionLocked />
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <Diary />;
}

function Diary() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const today = todayLocal();
  const [day, setDay] = useState(params.day && DAY_RE.test(params.day) ? params.day : today);
  const previousDay = addDays(day, -1);
  // "Copy from yesterday", or from the day before the one shown: "Copy from Sun, Oct 19".
  const previousWords = inSentence(dayLabel(previousDay, today));

  const settings = useNutritionSettings();
  const goals = useNutritionGoals();
  const entries = useDiaryEntries(day);
  const previous = useDiaryEntries(previousDay);
  const exercise = useExerciseCalories(day);
  const { log } = useLogEntries();
  const { update } = useUpdateEntry();
  const { remove } = useDeleteEntry();
  const saveMeal = useSaveMeal();
  const profile = useProfile();
  const [editing, setEditing] = useState<DiaryEntry | null>(null);

  const s = settings.data ?? DEFAULT_NUTRITION_SETTINGS;
  if (entries.isLoading && !entries.data) return <LoadingView />;

  const view = diaryDay({
    day,
    entries: entries.data ?? [],
    mealNames: s.mealNames,
    goals: goals.data ?? [],
    exerciseKcal: exercise?.totalCalories ?? 0,
    addExercise: s.addExercise,
  });
  const previousEntries = previous.data ?? [];

  const copyFromPreviousDay = (meal?: number) => {
    const source = meal == null ? previousEntries : previousEntries.filter((e) => e.meal === meal);
    log(copyEntries(source, { day, meal, loggedAt: new Date().toISOString() }, newId));
  };

  const saveAsMeal = (entries: DiaryEntry[], suggested: string) =>
    Alert.prompt(
      'Save as a meal',
      'Log these foods again in one tap, from Add food > Meals.',
      (typed) => {
        const name = cleanMealName(typed ?? '');
        if (!name) return;
        saveMeal.mutate(
          { id: newId(), name, items: itemsFromEntries(entries) },
          {
            onSuccess: () => Alert.alert('Meal saved', `“${name}” is in Add food > Meals.`),
            onError: (e) => Alert.alert('Couldn’t save the meal', e instanceof Error ? e.message : 'Check your connection and try again.'),
          },
        );
      },
      'plain-text',
      suggested,
    );

  const addTo = (meal: number) => router.push({ pathname: '/nutrition/add', params: { day, meal: String(meal) } });

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        {...keyboardAware}
        refreshControl={
          <RefreshControl
            tintColor={colors.textMuted}
            refreshing={entries.isRefetching}
            onRefresh={() => {
              void entries.refetch();
              void goals.refetch();
              void settings.refetch();
            }}
          />
        }
      >
        <View style={styles.dayNav}>
          <Pressable
            onPress={() => setDay(addDays(day, -1))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => setDay(today)}
            disabled={day === today}
            accessibilityRole="button"
            accessibilityHint={day === today ? undefined : 'Goes back to today'}
          >
            <Text style={text.heading}>{dayLabel(day, today)}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDay(addDays(day, 1))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <Card>
          <CalorieSummary budget={view.budget} unit={s.energyUnit} />
          <MacroBars total={view.total} progress={view.macros} netCarbs={s.netCarbs} />
          {view.goal ? null : (
            <Button label="Set a calorie goal" variant="secondary" onPress={() => router.push('/nutrition/goals')} />
          )}
        </Card>

        {view.isEmpty && previousEntries.length > 0 ? (
          <Button
            label={`Copy all of ${previousWords}`}
            variant="secondary"
            onPress={() => copyFromPreviousDay()}
          />
        ) : null}

        {view.meals.map((meal) => {
          const before = previousEntries.filter((e) => e.meal === meal.index);
          return (
            <MealSection
              key={meal.index}
              meal={meal}
              unit={s.energyUnit}
              onPressEntry={setEditing}
              onAdd={() => addTo(meal.index)}
              copyLabel={before.length > 0 ? `Copy from ${previousWords}` : undefined}
              onCopy={before.length > 0 ? () => copyFromPreviousDay(meal.index) : undefined}
              onSaveMeal={() => saveAsMeal(meal.entries, meal.name)}
            />
          );
        })}

        <WaterCard
          day={day}
          unit={profile.data?.unit ?? 'lb'}
          goalMl={s.waterGoalMl}
          onSetGoal={() => router.push('/nutrition/settings')}
        />

        <NutrientsCard key={day} total={view.total} goal={view.goal} netCarbs={s.netCarbs} />

        {exercise && exercise.entries.length > 0 ? (
          <Card title="Exercise">
            {exercise.entries.map((e) => (
              <View key={e.id} style={styles.exerciseRow}>
                <Text style={[text.body, styles.flex]} numberOfLines={1}>
                  {e.title}
                </Text>
                <Text style={styles.number}>
                  {e.calories == null ? 'No estimate' : `${formatEnergy(e.calories, s.energyUnit)} ${energyUnitLabel(s.energyUnit)}`}
                </Text>
              </View>
            ))}
            <Text style={text.caption}>
              {s.addExercise
                ? 'Added to today’s budget. Estimates, not measurements.'
                : 'Not added to the budget (a setting). Estimates, not measurements.'}
            </Text>
          </Card>
        ) : null}

        <DayNote key={day} day={day} />

        <Card>
          {[
            { label: 'Goals and targets', path: '/nutrition/goals' },
            { label: 'Weight', path: '/nutrition/weight' },
            { label: 'Reports', path: '/nutrition/reports' },
            { label: 'Diary settings', path: '/nutrition/settings' },
          ].map((link, i) => (
            <Pressable
              key={link.path}
              onPress={() => router.push(link.path)}
              style={({ pressed }) => [styles.linkRow, i > 0 && styles.linkBorder, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={text.body}>{link.label}</Text>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
        </Card>
      </ScrollView>

      {editing ? (
        <EntrySheet
          key={editing.id}
          entry={editing}
          mealNames={view.meals.map((m) => m.name)}
          energyUnit={s.energyUnit}
          onClose={() => setEditing(null)}
          onSave={(after) => {
            update(editing, after);
            setEditing(null);
          }}
          onDelete={() => {
            remove(editing);
            setEditing(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** The day's note, saved when you leave the field, and "complete this day". */
function DayNote({ day }: { day: string }) {
  const info = useDiaryDay(day);
  const { save } = useSaveDiaryDay();
  const [draft, setDraft] = useState<string | null>(null);
  const saved = info.data?.note ?? '';
  const completedAt = info.data?.completedAt ?? null;
  const shown = draft ?? saved;
  const changed = draft != null && draft.trim() !== saved.trim();
  const saveNote = () => {
    if (changed) save(day, { note: draft, completedAt });
    setDraft(null);
  };

  return (
    <Card title="Notes">
      <TextInput
        value={shown}
        onChangeText={setDraft}
        onBlur={saveNote}
        placeholder="How the day went, what to change tomorrow"
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={2000}
        style={styles.note}
        accessibilityLabel="Notes for the day"
      />
      {changed ? (
        <Pressable onPress={saveNote} hitSlop={8} accessibilityRole="button" style={styles.saveNote}>
          <Text style={styles.link}>Save note</Text>
        </Pressable>
      ) : null}
      {completedAt ? (
        <View style={styles.completeRow}>
          <Text style={text.bodyMuted}>✓ Marked complete</Text>
          <Pressable onPress={() => save(day, { note: shown, completedAt: null })} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Undo</Text>
          </Pressable>
        </View>
      ) : (
        <Button
          label="Mark this day complete"
          variant="secondary"
          onPress={() => save(day, { note: shown, completedAt: new Date().toISOString() })}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 32, color: colors.primary, paddingHorizontal: spacing.md, lineHeight: 34 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  number: { color: colors.text, fontVariant: ['tabular-nums'] },
  note: {
    minHeight: 72,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  completeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveNote: { alignSelf: 'flex-end' },
  link: { color: colors.primary, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  linkBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
});
