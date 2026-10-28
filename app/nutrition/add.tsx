import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { Chips } from '@/components/nutrition/Chips';
import { FoodAmountSheet } from '@/components/nutrition/FoodAmountSheet';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import {
  MIN_SEARCH_LENGTH,
  useFood,
  useFoodHistory,
  useFoodSearch,
  useLogEntries,
  useNutritionSettings,
  useOffFood,
} from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { energyUnitLabel, formatEnergy, mealNamesFor, SOURCE_LABELS } from '@/domain/nutrition/diary';
import { copyEntries, entryFromFood, MAX_MEALS, type DiaryEntry } from '@/domain/nutrition/entries';
import { formatAmount, type Food } from '@/domain/nutrition/foods';
import { frequentFoods, recentFoods } from '@/domain/nutrition/history';
import { DEFAULT_NUTRITION_SETTINGS } from '@/domain/nutrition/settings';
import { addDays } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { searchOpenFoodFacts } from '@/lib/openFoodFacts';
import { qk } from '@/lib/queryClient';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Frequent foods count the last 30 days. */
const FREQUENT_DAYS = 30;

/** What was tapped: a food to load by id or barcode, maybe with last time's amount. */
interface Picked {
  foodId?: string | null;
  barcode?: string | null;
  amount?: number;
  unitLabel?: string;
}

export default function AddFoodScreen() {
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
  return <AddFood />;
}

function AddFood() {
  const router = useRouter();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ day?: string; meal?: string }>();
  const day = params.day && DAY_RE.test(params.day) ? params.day : todayLocal();
  const mealParam = Number(params.meal);
  const meal = Number.isInteger(mealParam) && mealParam >= 0 && mealParam < MAX_MEALS ? mealParam : 0;

  const settings = useNutritionSettings();
  const s = settings.data ?? DEFAULT_NUTRITION_SETTINGS;
  const history = useFoodHistory();
  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);
  const [list, setList] = useState<'recent' | 'frequent'>('recent');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Picked | null>(null);
  const { log } = useLogEntries();

  const off = useMutation({ mutationFn: searchOpenFoodFacts });
  const offQuery = off.variables;

  const pickedFood = useFood(picked?.foodId ?? null);
  const pickedOff = useOffFood(picked?.foodId ? null : picked?.barcode ?? null);
  const food: Food | null = picked?.foodId ? pickedFood.data ?? null : pickedOff.data ?? null;
  const loadingFood = picked?.foodId ? pickedFood.isLoading : pickedOff.isLoading;
  const problem = pickedOff.error ? 'Looking this up needs a connection. Use + on the list to log the same amount again.' : null;

  const mealNames = mealNamesFor(s.mealNames, meal);
  const q = query.trim();
  const searching = q.length >= MIN_SEARCH_LENGTH;

  const done = () => router.back();

  const logAgain = (entry: DiaryEntry) => {
    log(copyEntries([entry], { day, meal, loggedAt: new Date().toISOString() }, newId));
    setAdded((prev) => new Set(prev).add(entry.id));
  };

  const historyRows =
    list === 'recent'
      ? recentFoods(history.data ?? [], 30).map((entry) => ({ entry, days: null as number | null }))
      : frequentFoods(history.data ?? [], addDays(todayLocal(), -FREQUENT_DAYS), 30);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        <Text style={text.caption}>
          Adding to {mealNames[meal]} · {day === todayLocal() ? 'today' : day}
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods"
          placeholderTextColor={colors.textFaint}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.search}
          accessibilityLabel="Search foods"
        />

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.replace({ pathname: '/nutrition/quick', params: { day, meal: String(meal) } })}
            style={styles.action}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Quick add</Text>
          </Pressable>
        </View>

        {searching ? (
          <>
            <Card title="Foods">
              {search.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : search.error && !search.data ? (
                <Text style={text.bodyMuted}>Search needs a connection. Recent and frequent foods work offline.</Text>
              ) : (search.data ?? []).length === 0 ? (
                <Text style={text.bodyMuted}>Nothing in the catalog or your foods matches “{q}”.</Text>
              ) : (
                (search.data ?? []).map((f) => (
                  <FoodRow key={f.id ?? f.name} food={f} unit={s.energyUnit} onPress={() => setPicked({ foodId: f.id })} />
                ))
              )}
            </Card>

            <Card title="Open Food Facts">
              {off.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : off.data && offQuery === q ? (
                'problem' in off.data ? (
                  <Text style={text.bodyMuted}>
                    {off.data.problem === 'offline'
                      ? 'Open Food Facts needs a connection.'
                      : 'Open Food Facts didn’t answer. Try again in a minute.'}
                  </Text>
                ) : off.data.foods.length === 0 ? (
                  <Text style={text.bodyMuted}>No packaged foods match “{q}”.</Text>
                ) : (
                  off.data.foods.map((f) => (
                    <FoodRow
                      key={f.barcode ?? f.name}
                      food={f}
                      unit={s.energyUnit}
                      onPress={() => {
                        if (!f.barcode) return;
                        client.setQueryData(qk.offFood(f.barcode), f);
                        setPicked({ barcode: f.barcode });
                      }}
                    />
                  ))
                )
              ) : (
                <Pressable onPress={() => off.mutate(q)} accessibilityRole="button" hitSlop={6}>
                  <Text style={styles.link}>Search packaged foods for “{q}”</Text>
                </Pressable>
              )}
              <Text style={text.caption}>Open Food Facts is a free database anyone can edit.</Text>
            </Card>
          </>
        ) : (
          <Card>
            <Chips
              options={[
                { key: 'recent', label: 'Recent' },
                { key: 'frequent', label: 'Frequent' },
              ]}
              selected={list}
              onSelect={setList}
            />
            {history.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : historyRows.length === 0 ? (
              <Text style={text.bodyMuted}>Foods you log show up here, ready to log again.</Text>
            ) : (
              historyRows.map(({ entry, days }) => (
                <View key={entry.id} style={styles.row}>
                  <Pressable
                    style={styles.rowText}
                    onPress={() => setPicked({ foodId: entry.foodId, barcode: entry.barcode, amount: entry.amount, unitLabel: entry.unit })}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.name}, ${formatAmount(entry.amount, entry.unit)}. Choose an amount`}
                  >
                    <Text style={text.body} numberOfLines={1}>
                      {entry.name}
                    </Text>
                    <Text style={text.caption} numberOfLines={1}>
                      {[
                        entry.brand,
                        formatAmount(entry.amount, entry.unit),
                        `${formatEnergy(entry.nutrients.kcal, s.energyUnit)} ${energyUnitLabel(s.energyUnit)}`,
                        days != null ? `${days} day${days === 1 ? '' : 's'}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => logAgain(entry)}
                    disabled={added.has(entry.id)}
                    hitSlop={8}
                    style={styles.plus}
                    accessibilityRole="button"
                    accessibilityLabel={added.has(entry.id) ? `${entry.name} added` : `Log ${entry.name} again, same amount`}
                  >
                    <Text style={[styles.plusText, added.has(entry.id) && styles.plusDone]}>
                      {added.has(entry.id) ? '✓' : '+'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        )}
      </ScrollView>

      {picked ? (
        <FoodAmountSheet
          // A fresh sheet once the food has loaded, so its unit and amount start from the food.
          key={`${picked.foodId ?? picked.barcode}:${food ? 'ready' : 'loading'}`}
          visible
          food={food}
          loading={loadingFood}
          problem={problem}
          initialAmount={picked.amount}
          initialUnitLabel={picked.unitLabel}
          meal={meal}
          mealNames={mealNames}
          energyUnit={s.energyUnit}
          netCarbs={s.netCarbs}
          onClose={() => setPicked(null)}
          onAdd={({ amount, unitKey, meal: chosenMeal }) => {
            if (!food) return;
            const entry = entryFromFood(food, amount, unitKey, {
              id: newId(),
              day,
              meal: chosenMeal,
              loggedAt: new Date().toISOString(),
            });
            if (!entry) return;
            log([entry]);
            setPicked(null);
            done();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** A food in a list: name, where it's from, and its energy per basis. */
function FoodRow({ food, unit, onPress }: { food: Food; unit: 'kcal' | 'kj'; onPress: () => void }) {
  const per =
    food.basis === 'serving' ? food.servingLabel ?? 'serving' : food.basis === '100ml' ? '100 ml' : '100 g';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}${food.brand ? `, ${food.brand}` : ''}. Choose an amount`}
    >
      <View style={styles.rowText}>
        <Text style={text.body} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={text.caption} numberOfLines={1}>
          {[food.brand, SOURCE_LABELS[food.source], `${formatEnergy(food.nutrients.kcal, unit)} ${energyUnitLabel(unit)} per ${per}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  search: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  actionText: { color: colors.text, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, minWidth: 0 },
  plus: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  plusText: { color: colors.primary, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  plusDone: { color: colors.success },
  link: { color: colors.primary, fontWeight: '700' },
});
