import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ModalScreen } from '@/components/ModalScreen';
import { keyboardAware } from '@/components/keyboard';
import {
  energyUnitLabel,
  formatEnergy,
  formatGrams,
  parseAmount,
  parseOptionalNumber,
  SOURCE_LABELS,
} from '@/domain/nutrition/diary';
import { quickAddEntry, rescaleEntry, type DiaryEntry } from '@/domain/nutrition/entries';
import { formatAmount } from '@/domain/nutrition/foods';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

import { Chips } from './Chips';

/**
 * Change a logged entry: how much, or which meal, or delete it. A quick add
 * has no food behind it, so its calories and macros are edited directly.
 * Give it a `key` per entry so it starts from that entry.
 */
export function EntrySheet({
  entry,
  mealNames,
  energyUnit,
  onClose,
  onSave,
  onDelete,
}: {
  entry: DiaryEntry;
  mealNames: readonly string[];
  energyUnit: 'kcal' | 'kj';
  onClose: () => void;
  onSave: (after: DiaryEntry) => void;
  onDelete: () => void;
}) {
  const quick = entry.source === 'quick';
  const [amountText, setAmountText] = useState(String(Math.round(entry.amount * 100) / 100));
  const [meal, setMeal] = useState(entry.meal);
  const [kcalText, setKcalText] = useState(String(Math.round(entry.nutrients.kcal)));
  const [proteinText, setProteinText] = useState(entry.nutrients.proteinG == null ? '' : String(entry.nutrients.proteinG));
  const [carbsText, setCarbsText] = useState(entry.nutrients.carbsG == null ? '' : String(entry.nutrients.carbsG));
  const [fatText, setFatText] = useState(entry.nutrients.fatG == null ? '' : String(entry.nutrients.fatG));

  let after: DiaryEntry | null;
  if (quick) {
    const kcal = parseOptionalNumber(kcalText);
    const macros = [parseOptionalNumber(proteinText), parseOptionalNumber(carbsText), parseOptionalNumber(fatText)];
    after =
      kcal == null || Number.isNaN(kcal) || macros.some((m) => Number.isNaN(m))
        ? null
        : quickAddEntry(
            { kcal, proteinG: macros[0], carbsG: macros[1], fatG: macros[2], name: entry.name },
            { id: entry.id, day: entry.day, meal, loggedAt: entry.loggedAt },
          );
  } else {
    const amount = parseAmount(amountText);
    const rescaled = amount == null ? null : rescaleEntry(entry, amount);
    after = rescaled ? { ...rescaled, meal } : null;
  }

  const confirmDelete = () =>
    Alert.alert('Delete this entry?', entry.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <ModalScreen visible onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={text.heading}>Edit entry</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
        <View>
          <Text style={text.title}>{entry.name}</Text>
          <Text style={text.caption}>
            {[entry.brand, SOURCE_LABELS[entry.source], quick ? null : `logged as ${formatAmount(entry.amount, entry.unit)}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {quick ? (
          <View style={styles.quickGrid}>
            <Field label={`Calories (${energyUnitLabel('kcal')})`} value={kcalText} onChangeText={setKcalText} keyboardType="decimal-pad" />
            <Field label="Protein (g)" value={proteinText} onChangeText={setProteinText} keyboardType="decimal-pad" />
            <Field label="Carbs (g)" value={carbsText} onChangeText={setCarbsText} keyboardType="decimal-pad" />
            <Field label="Fat (g)" value={fatText} onChangeText={setFatText} keyboardType="decimal-pad" />
          </View>
        ) : (
          <View style={styles.amountRow}>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[styles.amount, !after && styles.amountBad]}
              accessibilityLabel="Amount"
            />
            <Text style={styles.unitShown} numberOfLines={2}>
              {entry.unit}
            </Text>
          </View>
        )}

        <Text style={text.label}>MEAL</Text>
        <Chips options={mealNames.map((name, i) => ({ key: i, label: name }))} selected={meal} onSelect={setMeal} />

        {after ? (
          <Text style={text.bodyMuted}>
            {formatEnergy(after.nutrients.kcal, energyUnit)} {energyUnitLabel(energyUnit)} · carbs{' '}
            {formatGrams(after.nutrients.carbsG)} · fat {formatGrams(after.nutrients.fatG)} · protein{' '}
            {formatGrams(after.nutrients.proteinG)}
          </Text>
        ) : null}

        <Button label="Save" size="lg" disabled={!after} onPress={() => after && onSave(after)} />
        <Button label="Delete entry" variant="danger" onPress={confirmDelete} />
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
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  quickGrid: { gap: spacing.md },
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
});
