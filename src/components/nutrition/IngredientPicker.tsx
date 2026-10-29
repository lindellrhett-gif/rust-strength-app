import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ModalScreen } from '@/components/ModalScreen';
import { keyboardAware } from '@/components/keyboard';
import { MIN_SEARCH_LENGTH, useFood, useFoodSearch } from '@/data/nutrition';
import { energyUnitLabel, formatEnergy, SOURCE_LABELS } from '@/domain/nutrition/diary';
import type { Food } from '@/domain/nutrition/foods';
import { recipeItem, type RecipeItem } from '@/domain/nutrition/recipes';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

import { FoodAmountForm } from './FoodAmountSheet';

/**
 * Choose a food for a recipe ingredient and how much of it, in one sheet:
 * search first, then the amount. Starts from the ingredient's own words
 * when it was imported ("rolled oats").
 */
export function IngredientPicker({
  initialQuery,
  initialFood,
  initialAmount,
  initialUnitLabel,
  line,
  energyUnit,
  netCarbs,
  onClose,
  onPick,
}: {
  initialQuery: string;
  initialFood?: Food | null;
  initialAmount?: number;
  initialUnitLabel?: string;
  /** The recipe's own line, shown for reference. */
  line?: string;
  energyUnit: 'kcal' | 'kj';
  netCarbs: boolean;
  onClose: () => void;
  onPick: (item: RecipeItem, food: Food) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [chosenId, setChosenId] = useState<string | null>(initialFood?.id ?? null);
  const search = useFoodSearch(query);
  const chosen = useFood(chosenId);
  const food = chosen.data ?? (initialFood && initialFood.id === chosenId ? initialFood : null);
  const searching = query.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <ModalScreen visible onRequestClose={onClose}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (chosenId ? setChosenId(null) : onClose())}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.close}>{chosenId ? 'Back' : 'Close'}</Text>
        </Pressable>
        <Text style={text.heading}>Ingredient</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        {line ? <Text style={text.caption}>From the recipe: {line}</Text> : null}
        {chosenId ? (
          food ? (
            <FoodAmountForm
              key={`${food.id}:${food.portions.length}`}
              food={food}
              initialAmount={initialFood?.id === food.id ? initialAmount : undefined}
              initialUnitLabel={initialFood?.id === food.id ? initialUnitLabel : undefined}
              meal={0}
              mealNames={[]}
              showMeal={false}
              actionLabel="Use in recipe"
              energyUnit={energyUnit}
              netCarbs={netCarbs}
              onAdd={({ amount, unitKey }) => {
                const item = recipeItem(food, amount, unitKey);
                if (item) onPick(item, food);
              }}
            />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )
        ) : (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods"
              placeholderTextColor={colors.textFaint}
              autoFocus={!initialQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={styles.search}
              accessibilityLabel="Search foods"
            />
            {!searching ? (
              <Text style={text.bodyMuted}>Type a food to search.</Text>
            ) : search.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : search.error && !search.data ? (
              <Text style={text.bodyMuted}>Search needs a connection.</Text>
            ) : (search.data ?? []).length === 0 ? (
              <Text style={text.bodyMuted}>Nothing matches “{query.trim()}”. Try fewer words.</Text>
            ) : (
              (search.data ?? []).map((f) => (
                <Pressable
                  key={f.id ?? f.name}
                  onPress={() => setChosenId(f.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={text.body} numberOfLines={2}>
                    {f.name}
                  </Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {[f.brand, SOURCE_LABELS[f.source], `${formatEnergy(f.nutrients.kcal, energyUnit)} ${energyUnitLabel(energyUnit)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16, minWidth: 48 },
  spacer: { minWidth: 48 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
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
  row: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
});
