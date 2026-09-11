import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadingView } from '@/components';
import {
  useDeleteTemplate,
  useStartWorkoutFromTemplate,
  useTemplates,
  type TemplateWithItems,
} from '@/data/templates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function TemplatesScreen() {
  const router = useRouter();
  const templates = useTemplates();
  const startFromTemplate = useStartWorkoutFromTemplate();
  const remove = useDeleteTemplate();

  const start = async (t: TemplateWithItems) => {
    try {
      const workoutId = await startFromTemplate.mutateAsync(t.id);
      router.replace(`/workout/${workoutId}`);
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const confirmDelete = (t: TemplateWithItems) =>
    Alert.alert('Delete preset?', `"${t.name}" — your logged workouts are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(t.id) },
    ]);

  if (templates.isLoading) return <LoadingView />;

  const list = templates.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Presets' }} />

      <ScrollView contentContainerStyle={styles.content}>
        {list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={text.heading}>No presets yet</Text>
            <Text style={[text.bodyMuted, styles.emptyMsg]}>
              A preset is a saved list of exercises — like &quot;Push Day 1&quot;. Build one here, or
              finish a workout and tap &quot;Save as preset&quot; to keep what you just did.
            </Text>
          </View>
        ) : (
          list.map((t) => (
            <View key={t.id} style={styles.card}>
              <Pressable
                onPress={() => router.push(`/templates/${t.id}`)}
                onLongPress={() => confirmDelete(t)}
                style={styles.cardHead}
              >
                <View style={styles.cardTitle}>
                  <Text style={text.heading}>{t.name}</Text>
                  <Text style={text.caption}>
                    {t.items.length} exercise{t.items.length === 1 ? '' : 's'} ·{' '}
                    {t.items.reduce((n, i) => n + i.targetSets, 0)} sets
                  </Text>
                </View>
                <Text style={styles.edit}>Edit ›</Text>
              </Pressable>

              <View style={styles.items}>
                {t.items.slice(0, 6).map((item, i) => (
                  <Text key={item.id} style={text.caption} numberOfLines={1}>
                    {i + 1}. {item.exerciseName}
                    <Text style={styles.faint}>{`  ${item.targetSets}×${item.targetRepLow}–${item.targetRepHigh}`}</Text>
                  </Text>
                ))}
                {t.items.length > 6 ? (
                  <Text style={styles.faint}>+{t.items.length - 6} more</Text>
                ) : null}
              </View>

              <Button
                label="Start this workout"
                onPress={() => start(t)}
                loading={startFromTemplate.isPending}
                disabled={t.items.length === 0}
              />
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="+ New preset" size="lg" onPress={() => router.push('/templates/new')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyMsg: { textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { gap: 2, flexShrink: 1 },
  edit: { color: colors.primary, fontWeight: '700' },
  items: { gap: 2 },
  faint: { color: colors.textFaint, fontSize: 13 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
