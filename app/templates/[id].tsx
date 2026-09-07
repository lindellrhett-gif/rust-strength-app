import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, LoadingView } from '@/components';
import { CreateExerciseModal } from '@/components/CreateExerciseModal';
import { NumberStepper } from '@/components/NumberStepper';
import { SelectSheet, type Option } from '@/components/SelectSheet';
import { useCreateExercise, useExercises } from '@/data/exercises';
import { useProfile } from '@/data/profile';
import { useSaveTemplate, useTemplate } from '@/data/templates';
import { repRangeOrDefault } from '@/domain/recommender';
import { normalizeTemplateName, type TemplateDraftItem } from '@/domain/templates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function TemplateEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const existing = useTemplate(isNew ? undefined : id);
  const exercises = useExercises();
  const profile = useProfile();
  const createExercise = useCreateExercise();
  const save = useSaveTemplate();

  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateDraftItem[]>([]);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingName, setPendingName] = useState('');

  const [repLow, repHigh] = repRangeOrDefault(
    profile.data?.target_rep_low ?? 6,
    profile.data?.target_rep_high ?? 8,
  );

  // Seed the editor when the saved preset arrives. Adjusting state during
  // render (rather than in an effect) is React's recommended pattern for
  // derived state and avoids a second render pass.
  if (!isNew && existing.data && seededFrom !== existing.data.id) {
    setSeededFrom(existing.data.id);
    setName(existing.data.name);
    setItems(
      existing.data.items.map((i) => ({
        exerciseId: i.exerciseId,
        exerciseName: i.exerciseName,
        targetSets: i.targetSets,
        targetRepLow: i.targetRepLow,
        targetRepHigh: i.targetRepHigh,
      })),
    );
  }

  const chosen = useMemo(() => new Set(items.map((i) => i.exerciseId)), [items]);

  const options: Option[] = useMemo(
    () =>
      (exercises.data ?? [])
        .filter((e) => !chosen.has(e.id))
        .map((e) => ({ id: e.id, label: e.name, sublabel: e.muscle_group })),
    [exercises.data, chosen],
  );

  const addExercise = (exerciseId: string) => {
    const ex = exercises.data?.find((e) => e.id === exerciseId);
    if (!ex) return;
    setItems((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: 3,
        targetRepLow: repLow,
        targetRepHigh: repHigh,
      },
    ]);
    setShowPicker(false);
  };

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateItem = (index: number, patch: Partial<TemplateDraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const cleanName = normalizeTemplateName(name);
  const canSave = !!cleanName && items.length > 0;

  const submit = async () => {
    if (!canSave) return;
    try {
      await save.mutateAsync({
        templateId: isNew ? undefined : id,
        name: cleanName,
        items,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert(
        'Could not save',
        msg.includes('duplicate') || msg.includes('unique')
          ? 'You already have a preset with that name.'
          : msg,
      );
    }
  };

  if (!isNew && existing.isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: isNew ? 'New preset' : 'Edit preset' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Preset name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Push Day 1"
          maxLength={60}
        />

        {items.length === 0 ? (
          <Text style={[text.bodyMuted, styles.empty]}>
            Add the exercises you do in this session, in the order you do them.
          </Text>
        ) : (
          items.map((item, index) => (
            <View key={`${item.exerciseId}-${index}`} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={text.heading} numberOfLines={1}>
                  {index + 1}. {item.exerciseName}
                </Text>
                <View style={styles.reorder}>
                  <Pressable onPress={() => move(index, -1)} hitSlop={8} disabled={index === 0}>
                    <Text style={[styles.arrow, index === 0 && styles.arrowOff]}>▲</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => move(index, 1)}
                    hitSlop={8}
                    disabled={index === items.length - 1}
                  >
                    <Text style={[styles.arrow, index === items.length - 1 && styles.arrowOff]}>
                      ▼
                    </Text>
                  </Pressable>
                </View>
              </View>

              <NumberStepper
                label="Sets"
                value={item.targetSets}
                onChange={(n) => updateItem(index, { targetSets: n })}
                min={1}
                max={20}
              />

              <View style={styles.repRow}>
                <NumberStepper
                  label="Low reps"
                  value={item.targetRepLow}
                  onChange={(n) => updateItem(index, { targetRepLow: n })}
                  min={1}
                  max={item.targetRepHigh}
                />
                <NumberStepper
                  label="High reps"
                  value={item.targetRepHigh}
                  onChange={(n) => updateItem(index, { targetRepHigh: n })}
                  min={item.targetRepLow}
                  max={30}
                />
              </View>

              <Pressable onPress={() => removeItem(index)} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        <Button
          label="＋ Add exercise"
          variant="secondary"
          onPress={() => setShowPicker(true)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={isNew ? 'Create preset' : 'Save changes'}
          size="lg"
          onPress={submit}
          disabled={!canSave}
          loading={save.isPending}
        />
      </View>

      <SelectSheet
        visible={showPicker}
        title="Add an exercise"
        options={options}
        onSelect={addExercise}
        onClose={() => setShowPicker(false)}
        createLabel="New exercise"
        onCreate={(q) => {
          setPendingName(q);
          setShowPicker(false);
          setShowCreate(true);
        }}
      />

      <CreateExerciseModal
        visible={showCreate}
        initialName={pendingName}
        busy={createExercise.isPending}
        onClose={() => setShowCreate(false)}
        onSubmit={async (input) => {
          const created = await createExercise.mutateAsync(input);
          setShowCreate(false);
          setItems((prev) => [
            ...prev,
            {
              exerciseId: created.id,
              exerciseName: created.name,
              targetSets: 3,
              targetRepLow: repLow,
              targetRepHigh: repHigh,
            },
          ]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  empty: { textAlign: 'center', paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reorder: { flexDirection: 'row', gap: spacing.lg },
  arrow: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  arrowOff: { color: colors.textFaint },
  repRow: { gap: spacing.md },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
});
