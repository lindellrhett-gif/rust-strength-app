import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, LoadingView } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import { Chips } from '@/components/nutrition/Chips';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { useDeleteFood, useFood, useSaveFood } from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { draftFromFood, emptyDraft, foodFromDraft, type DraftProblem, type FoodDraft } from '@/domain/nutrition/foodForm';
import type { Food, FoodBasis } from '@/domain/nutrition/foods';
import { NUTRIENT_KEYS, NUTRIENT_LABELS, type NutrientKey } from '@/domain/nutrition/nutrients';
import type { LookupResult } from '@/lib/openFoodFacts';
import { qk } from '@/lib/queryClient';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

const BASES: { key: FoodBasis; label: string }[] = [
  { key: 'serving', label: 'Per serving' },
  { key: '100g', label: 'Per 100 g' },
  { key: '100ml', label: 'Per 100 ml' },
];

/**
 * Create one of your own foods from its label, or edit one. Opened with
 * `?id=` to edit, `?barcode=` to start one for a scanned code, and
 * `?barcode=…&from=off` to start from that Open Food Facts product.
 */
export default function FoodEditScreen() {
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
  return <FoodEdit />;
}

function FoodEdit() {
  const params = useLocalSearchParams<{ id?: string; barcode?: string; from?: string }>();
  const client = useQueryClient();
  const existing = useFood(params.id ?? null);

  if (params.id) {
    if (existing.isLoading) return <LoadingView />;
    if (!existing.data) return <Missing />;
    return <FoodForm key={existing.data.id} start={existing.data} />;
  }
  // Starting from an Open Food Facts product already looked up on this phone:
  // by the scanner, or picked from a packaged-food search.
  let offFood: Food | null = null;
  if (params.from === 'off' && params.barcode) {
    const scanned = client.getQueryData<LookupResult>(qk.barcodeFood(params.barcode));
    offFood = scanned && 'food' in scanned ? scanned.food : client.getQueryData<Food>(qk.offFood(params.barcode)) ?? null;
  }
  return <FoodForm start={offFood} barcode={params.barcode ?? ''} />;
}

function Missing() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Text style={text.bodyMuted}>This food couldn’t be found. It may have been deleted.</Text>
      </View>
    </SafeAreaView>
  );
}

function FoodForm({ start, barcode = '' }: { start: Food | null; barcode?: string }) {
  const router = useRouter();
  const save = useSaveFood();
  const remove = useDeleteFood();
  // Editing your own food keeps its id; a product from Open Food Facts becomes a new food of yours.
  const editing = start && start.source !== 'off' && start.source !== 'usda' ? start : null;
  const [draft, setDraft] = useState<FoodDraft>(() => (start ? draftFromFood(start) : emptyDraft(barcode)));
  const [problems, setProblems] = useState<DraftProblem[]>([]);

  const set = (changes: Partial<FoodDraft>) => setDraft((d) => ({ ...d, ...changes }));
  const setNutrient = (key: NutrientKey, value: string) => setDraft((d) => ({ ...d, nutrients: { ...d.nutrients, [key]: value } }));
  const problem = (field: DraftProblem['field']) => problems.find((p) => p.field === field)?.message;

  const submit = () => {
    const result = foodFromDraft(draft);
    if ('problems' in result) {
      setProblems(result.problems);
      return;
    }
    setProblems([]);
    const food: Food = { ...result.food, id: editing?.id ?? null, source: 'user', portions: [] };
    save.mutate(
      { food, extra: start?.source === 'off' ? { from: 'open_food_facts' } : undefined },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('Couldn’t save the food', e instanceof Error ? e.message : 'Check your connection and try again.'),
      },
    );
  };

  const confirmDelete = () => {
    const id = editing?.id;
    if (!id) return;
    Alert.alert('Delete this food?', 'Entries you’ve already logged stay in your diary.', [
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

  const perServing = draft.basis === 'serving';
  const sizeUnit = draft.basis === '100ml' ? 'ml' : 'g';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: editing ? 'Edit food' : 'New food' }} />
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware} keyboardShouldPersistTaps="handled">
        {start?.source === 'off' ? (
          <Text style={text.caption}>
            Starting from Open Food Facts. Check each number against the label; your copy is private to you.
          </Text>
        ) : null}
        <Field label="Name" value={draft.name} onChangeText={(v) => set({ name: v })} error={problem('name')} maxLength={200} />
        <Field label="Brand (optional)" value={draft.brand} onChangeText={(v) => set({ brand: v })} error={problem('brand')} maxLength={120} />
        <Field
          label="Barcode (optional)"
          value={draft.barcode}
          onChangeText={(v) => set({ barcode: v })}
          error={problem('barcode')}
          keyboardType="number-pad"
          maxLength={14}
        />

        <Text style={text.label}>NUTRITION GIVEN</Text>
        <Chips options={BASES} selected={draft.basis} onSelect={(basis) => set({ basis })} />
        <Field
          label={perServing ? 'One serving is' : 'A serving (optional)'}
          value={draft.servingLabel}
          onChangeText={(v) => set({ servingLabel: v })}
          placeholder={perServing ? '1 bar' : '1 can'}
          error={problem('servingLabel')}
          maxLength={60}
        />
        <Field
          label={`Serving size in ${sizeUnit} (optional)`}
          value={draft.servingSize}
          onChangeText={(v) => set({ servingSize: v })}
          keyboardType="decimal-pad"
          error={problem('servingSize')}
        />

        <Text style={text.label}>{perServing ? 'PER SERVING' : `PER 100 ${sizeUnit.toUpperCase()}`}</Text>
        {NUTRIENT_KEYS.map((key) => (
          <Field
            key={key}
            label={`${NUTRIENT_LABELS[key].label} (${NUTRIENT_LABELS[key].unit})${key === 'kcal' ? '' : ', optional'}`}
            value={draft.nutrients[key]}
            onChangeText={(v) => setNutrient(key, v)}
            keyboardType="decimal-pad"
            error={problem(key)}
          />
        ))}

        {problems.length > 0 ? <Text style={styles.error}>Fix the fields marked above.</Text> : null}
        <Button label={editing ? 'Save changes' : 'Save food'} size="lg" onPress={submit} loading={save.isPending} />
        {editing ? <Button label="Delete food" variant="danger" onPress={confirmDelete} loading={remove.isPending} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  error: { color: colors.danger },
});
