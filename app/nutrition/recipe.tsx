import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, LoadingView } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { IngredientPicker } from '@/components/nutrition/IngredientPicker';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { bestFoodMatch, useDeleteFood, useNutritionSettings, useRecipe, useSaveRecipe } from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { carbsShown, energyUnitLabel, formatEnergy, formatGrams, parseAmount } from '@/domain/nutrition/diary';
import { formatAmount, type Food } from '@/domain/nutrition/foods';
import { measureLine, parseLine, searchTermFor } from '@/domain/nutrition/recipeImport';
import { MAX_SERVINGS, recipeFood, recipeItem, type RecipeItem } from '@/domain/nutrition/recipes';
import { DEFAULT_NUTRITION_SETTINGS } from '@/domain/nutrition/settings';
import { newId } from '@/lib/ids';
import { fetchRecipe } from '@/lib/recipeImport';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** One ingredient as the screen holds it. */
interface Line {
  key: string;
  /** The recipe's own words, when imported. */
  text: string | null;
  /** What to search for when choosing a food. */
  term: string;
  food: Food | null;
  item: RecipeItem | null;
}

const IMPORT_PROBLEMS = {
  bad_link: 'That doesn’t look like a web address.',
  offline: 'Importing needs a connection.',
  unavailable: 'The page didn’t load. Check the link and try again.',
  no_recipe: 'That page doesn’t publish its recipe in a form apps can read. Add the ingredients yourself.',
} as const;

/** Build a recipe by hand or from a link, or edit one (`?id=`). */
export default function RecipeScreen() {
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
  return <RecipeLoader />;
}

function RecipeLoader() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecipe(id ?? null);
  if (id && existing.isLoading) return <LoadingView />;
  if (id && !existing.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Text style={text.bodyMuted}>This recipe couldn’t be found. It may have been deleted.</Text>
        </View>
      </SafeAreaView>
    );
  }
  return <RecipeEditor key={id ?? 'new'} existing={existing.data ?? null} />;
}

function RecipeEditor({ existing }: { existing: { food: Food; servings: number; items: RecipeItem[] } | null }) {
  const router = useRouter();
  const settings = useNutritionSettings();
  const s = settings.data ?? DEFAULT_NUTRITION_SETTINGS;
  const save = useSaveRecipe();
  const remove = useDeleteFood();

  const [recipeId] = useState(() => existing?.food.id ?? newId());
  const [name, setName] = useState(existing?.food.name ?? '');
  const [servingsText, setServingsText] = useState(existing ? String(existing.servings) : '4');
  const [lines, setLines] = useState<Line[]>(() =>
    (existing?.items ?? []).map((item) => ({ key: newId(), text: null, term: item.name, food: null, item })));
  const [link, setLink] = useState('');
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [importProblem, setImportProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | 'new' | null>(null);

  const servings = parseAmount(servingsText);
  const items = lines.map((l) => l.item);
  const unmatched = items.filter((i) => i == null).length;
  const food =
    servings && servings <= MAX_SERVINGS && unmatched === 0
      ? recipeFood({ id: recipeId, name, servings, items: items as RecipeItem[] })
      : null;
  const carbs = food ? carbsShown(food.nutrients, s.netCarbs) : null;

  const importLink = async () => {
    setImportProblem(null);
    const fetched = await fetchRecipe(link);
    if ('problem' in fetched) {
      setImportProblem(IMPORT_PROBLEMS[fetched.problem]);
      return;
    }
    const { recipe } = fetched;
    if (!name.trim()) setName(recipe.name);
    if (recipe.servings) setServingsText(String(recipe.servings));
    const parsed = recipe.lines.map(parseLine).filter((p) => !p.isHeading);
    setImporting({ done: 0, total: parsed.length });
    const matched: Line[] = [];
    // One at a time: a recipe is a dozen lines, and the catalog is searched for each.
    for (const p of parsed) {
      const term = searchTermFor(p) || p.description;
      const best = await bestFoodMatch(term).catch(() => null);
      const m = best ? measureLine(best, p) : null;
      matched.push({ key: newId(), text: p.text, term, food: best, item: best && m ? recipeItem(best, m.amount, m.unitKey) : null });
      setImporting({ done: matched.length, total: parsed.length });
    }
    setLines((current) => [...current, ...matched]);
    setImporting(null);
  };

  const submit = () => {
    if (!food || !servings) return;
    save.mutate(
      { recipe: food, servings, items: items as RecipeItem[] },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('Couldn’t save the recipe', e instanceof Error ? e.message : 'Check your connection and try again.'),
      },
    );
  };

  const confirmDelete = () => {
    if (!existing?.food.id) return;
    const id = existing.food.id;
    Alert.alert('Delete this recipe?', 'Entries you’ve already logged stay in your diary.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Couldn’t delete it', e instanceof Error ? e.message : 'Please try again.'),
          }),
      },
    ]);
  };

  const pickingLine = picking && picking !== 'new' ? lines.find((l) => l.key === picking) ?? null : null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit recipe' : 'New recipe' }} />
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        {!existing ? (
          <Card title="Import from a link">
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder="https://"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
              accessibilityLabel="Recipe link"
            />
            {importing ? (
              <View style={styles.progress}>
                <ActivityIndicator color={colors.primary} />
                <Text style={text.bodyMuted}>
                  Matching ingredients, {importing.done} of {importing.total}…
                </Text>
              </View>
            ) : (
              <Button label="Import" variant="secondary" disabled={!link.trim()} onPress={() => void importLink()} />
            )}
            {importProblem ? <Text style={styles.warn}>{importProblem}</Text> : null}
            <Text style={text.caption}>
              The page is read on your phone. Each ingredient is matched to a food; check them before saving.
            </Text>
          </Card>
        ) : null}

        <Field label="Name" value={name} onChangeText={setName} maxLength={200} placeholder="Overnight oats" />
        <Field
          label="Servings it makes"
          value={servingsText}
          onChangeText={setServingsText}
          keyboardType="decimal-pad"
          error={servings == null || servings > MAX_SERVINGS ? 'A number of servings above zero.' : undefined}
        />

        <Card title="Ingredients">
          {lines.length === 0 ? <Text style={text.bodyMuted}>Add each ingredient and how much of it goes in.</Text> : null}
          {lines.map((l) => (
            <View key={l.key} style={styles.lineRow}>
              <Pressable style={styles.lineText} onPress={() => setPicking(l.key)} accessibilityRole="button">
                {l.text ? (
                  <Text style={text.caption} numberOfLines={1}>
                    {l.text}
                  </Text>
                ) : null}
                {l.item ? (
                  <>
                    <Text style={text.body} numberOfLines={1}>
                      {l.item.name}
                    </Text>
                    <Text style={text.caption}>
                      {formatAmount(l.item.amount, l.item.unit)} · {formatEnergy(l.item.nutrients.kcal, s.energyUnit)}{' '}
                      {energyUnitLabel(s.energyUnit)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.warn}>{l.food ? `Choose how much ${l.food.name}` : 'Choose a food'}</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove ingredient"
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setPicking('new')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Add ingredient</Text>
          </Pressable>
        </Card>

        <Card title="Per serving">
          {food ? (
            <Text style={text.body}>
              {formatEnergy(food.nutrients.kcal, s.energyUnit)} {energyUnitLabel(s.energyUnit)} · {carbs?.label.toLowerCase()}{' '}
              {formatGrams(carbs?.grams ?? null)} · fat {formatGrams(food.nutrients.fatG)} · protein {formatGrams(food.nutrients.proteinG)}
              {food.servingG ? ` · ${Math.round(food.servingG)} g` : ''}
            </Text>
          ) : (
            <Text style={text.bodyMuted}>
              {unmatched > 0
                ? `${unmatched} ingredient${unmatched === 1 ? ' needs' : 's need'} a food first.`
                : 'Add a name, servings and an ingredient.'}
            </Text>
          )}
        </Card>

        <Button label={existing ? 'Save changes' : 'Save recipe'} size="lg" disabled={!food || !!importing} onPress={submit} loading={save.isPending} />
        {existing ? <Button label="Delete recipe" variant="danger" onPress={confirmDelete} loading={remove.isPending} /> : null}
      </ScrollView>

      {picking ? (
        <IngredientPicker
          key={picking}
          initialQuery={pickingLine?.term ?? ''}
          initialFood={pickingLine?.food ?? null}
          initialAmount={pickingLine?.item?.amount}
          initialUnitLabel={pickingLine?.item?.unit}
          line={pickingLine?.text ?? undefined}
          energyUnit={s.energyUnit}
          netCarbs={s.netCarbs}
          onClose={() => setPicking(null)}
          onPick={(item, picked) => {
            setLines((current) =>
              picking === 'new'
                ? [...current, { key: newId(), text: null, term: picked.name, food: picked, item }]
                : current.map((l) => (l.key === picking ? { ...l, food: picked, item } : l)));
            setPicking(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warn: { color: colors.warning, fontWeight: '600' },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineText: { flex: 1, minWidth: 0, gap: 2 },
  remove: { color: colors.textMuted, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700' },
});
