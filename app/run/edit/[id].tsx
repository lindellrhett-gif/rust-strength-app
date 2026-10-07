import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Field, LoadingView, Screen } from '@/components';
import { useDeleteRun, useRun, useUpdateRunDetails } from '@/data/runs';
import type { RunDetail } from '@/domain/running/detail';
import { effortLabel } from '@/domain/running/edit';
import { RUN_LIMITS } from '@/domain/running/validate';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function EditRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const run = useRun(id);
  if (run.data) return <EditRunForm run={run.data} />;
  if (run.isPending) return <LoadingView label="Loading run…" />;
  return <EmptyState title="Run not found" message="It may have been deleted." />;
}

function EditRunForm({ run }: { run: RunDetail }) {
  const router = useRouter();
  const update = useUpdateRunDetails();
  const remove = useDeleteRun();
  const [title, setTitle] = useState(run.title ?? '');
  const [note, setNote] = useState(run.note ?? '');
  const [effort, setEffort] = useState<number | null>(run.effort);

  const save = async () => {
    try {
      await update.mutateAsync({ id: run.id, title: title.trim() || null, note: note.trim() || null, effort });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this run?', 'Its route, splits and best efforts are deleted too. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete run',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(run.id);
            router.dismissAll();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder={run.name}
        maxLength={RUN_LIMITS.titleMax}
        returnKeyType="done"
      />
      <Field
        label="Notes"
        value={note}
        onChangeText={setNote}
        placeholder="How did it feel? Route, weather, shoes…"
        maxLength={RUN_LIMITS.noteMax}
        multiline
        style={styles.notes}
      />

      <View style={styles.effortBlock}>
        <Text style={text.label}>EFFORT</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EFFORTS.map((n) => {
            const selected = effort === n;
            return (
              <Pressable
                key={n}
                onPress={() => setEffort(selected ? null : n)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Effort ${n}, ${effortLabel(n).toLowerCase()}`}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={text.caption}>
          {effort == null ? 'How hard did it feel? Tap again to clear.' : `${effort}/10: ${effortLabel(effort)}`}
        </Text>
      </View>

      <Button label="Save" size="lg" onPress={() => void save()} loading={update.isPending} />

      <Card title="Route">
        {run.trimmable ? (
          <>
            <Text style={text.bodyMuted}>
              Left it running on the walk home, or started a block early? Trim the start or end and
              everything is worked out again.
            </Text>
            <Button label="Trim start or end" variant="secondary" onPress={() => router.push(`/run/trim/${run.id}`)} />
          </>
        ) : (
          <Text style={text.bodyMuted}>
            {run.route.length >= 2
              ? 'Runs saved before trimming was added can’t be trimmed.'
              : 'This run has no route to trim.'}
          </Text>
        )}
      </Card>

      <Button label="Delete run" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  effortBlock: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chipTextSelected: { color: colors.onPrimary },
});
