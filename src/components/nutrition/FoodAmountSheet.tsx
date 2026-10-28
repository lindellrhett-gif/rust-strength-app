import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { ModalScreen } from '@/components/ModalScreen';
import { keyboardAware } from '@/components/keyboard';
import { carbsShown, energyUnitLabel, formatEnergy, formatGrams, parseAmount, SOURCE_LABELS } from '@/domain/nutrition/diary';
import { defaultUnit, measure, unitsFor, type Food } from '@/domain/nutrition/foods';
import { NUTRIENT_KEYS, NUTRIENT_LABELS } from '@/domain/nutrition/nutrients';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

import { Chips } from './Chips';

export interface AmountChoice {
  amount: number;
  unitKey: string;
  meal: number;
}

/**
 * How much of a food, in which unit, for which meal, with its numbers worked
 * out as you type. Opened over the add-food screen; give it a `key` per food
 * so it starts fresh each time.
 */
export function FoodAmountSheet({
  visible,
  food,
  loading,
  problem,
  initialAmount,
  initialUnitLabel,
  meal: initialMeal,
  mealNames,
  energyUnit,
  netCarbs,
  onClose,
  onAdd,
}: {
  visible: boolean;
  food: Food | null;
  loading?: boolean;
  /** Why the food couldn't be shown, when it couldn't. */
  problem?: string | null;
  initialAmount?: number;
  initialUnitLabel?: string;
  meal: number;
  mealNames: readonly string[];
  energyUnit: 'kcal' | 'kj';
  netCarbs: boolean;
  onClose: () => void;
  onAdd: (choice: AmountChoice) => void;
}) {
  const units = food ? unitsFor(food) : [];
  // Last time's amount only means something in last time's unit.
  const matched = initialUnitLabel ? units.find((u) => u.label === initialUnitLabel) : undefined;
  const startUnit = matched ?? (food ? defaultUnit(food) : null);
  const [unitKey, setUnitKey] = useState<string | null>(startUnit?.key ?? null);
  const [amountText, setAmountText] = useState(() =>
    String(matched && initialAmount ? initialAmount : startUnit && ['g', 'ml'].includes(startUnit.key) ? 100 : 1));
  const [meal, setMeal] = useState(initialMeal);
  const [showAll, setShowAll] = useState(false);

  const amount = parseAmount(amountText);
  const chosenKey = unitKey ?? startUnit?.key ?? null;
  const measured = food && amount != null && chosenKey ? measure(food, amount, chosenKey) : null;
  const n = measured?.nutrients ?? null;
  const carbs = n ? carbsShown(n, netCarbs) : null;

  return (
    <ModalScreen visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={text.heading}>Add food</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      {!food ? (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          <Text style={text.bodyMuted}>{loading ? 'Loading…' : problem ?? 'This food couldn’t be found.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
          <View>
            <Text style={text.title}>{food.name}</Text>
            <Text style={text.caption}>{[food.brand, SOURCE_LABELS[food.source]].filter(Boolean).join(' · ')}</Text>
          </View>

          <View style={styles.amountRow}>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[styles.amount, amount == null && styles.amountBad]}
              accessibilityLabel="Amount"
            />
            <Text style={styles.unitShown} numberOfLines={2}>
              {units.find((u) => u.key === chosenKey)?.label ?? ''}
            </Text>
          </View>
          <Chips
            options={units.map((u) => ({ key: u.key, label: u.label }))}
            selected={chosenKey}
            onSelect={setUnitKey}
            accessibilityLabel="Unit"
          />

          <Text style={text.label}>MEAL</Text>
          <Chips
            options={mealNames.map((name, i) => ({ key: i, label: name }))}
            selected={meal}
            onSelect={setMeal}
            accessibilityLabel="Meal"
          />

          <View style={styles.preview}>
            <View style={styles.kcalBlock}>
              <Text style={styles.kcal}>{n ? formatEnergy(n.kcal, energyUnit) : '—'}</Text>
              <Text style={text.caption}>{energyUnitLabel(energyUnit)}</Text>
            </View>
            <Macro label={carbs?.label ?? 'Carbs'} value={carbs ? formatGrams(carbs.grams) : '—'} />
            <Macro label="Fat" value={n ? formatGrams(n.fatG) : '—'} />
            <Macro label="Protein" value={n ? formatGrams(n.proteinG) : '—'} />
          </View>

          <Button
            label={`Add to ${mealNames[meal] ?? 'meal'}`}
            size="lg"
            disabled={!measured}
            onPress={() => measured && chosenKey && onAdd({ amount: measured.amount, unitKey: chosenKey, meal })}
          />

          <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{showAll ? 'Hide nutrition facts' : 'Show nutrition facts'}</Text>
          </Pressable>
          {showAll && n ? (
            <View style={styles.facts}>
              {NUTRIENT_KEYS.map((key) => (
                <View key={key} style={styles.factRow}>
                  <Text style={text.body}>{NUTRIENT_LABELS[key].label}</Text>
                  <Text style={styles.factValue}>
                    {key === 'kcal'
                      ? `${formatEnergy(n.kcal, energyUnit)} ${energyUnitLabel(energyUnit)}`
                      : formatGrams(n[key], NUTRIENT_LABELS[key].unit)}
                  </Text>
                </View>
              ))}
              {food.source === 'off' ? (
                <Text style={text.caption}>From Open Food Facts, a database anyone can edit. Check it against the label.</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </ModalScreen>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={text.caption}>{label}</Text>
    </View>
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
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amount: {
    width: 120,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  amountBad: { borderColor: colors.danger },
  unitShown: { flex: 1, color: colors.textMuted, fontSize: 16 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  kcalBlock: { flex: 1.3, alignItems: 'center' },
  kcal: { fontSize: 28, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  macro: { flex: 1, alignItems: 'center' },
  macroValue: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  link: { color: colors.primary, fontWeight: '700' },
  facts: { gap: spacing.xs },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  factValue: { color: colors.text, fontVariant: ['tabular-nums'] },
});
