import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDurationShort } from '@/domain/duration';
import type { TimelineEntry } from '@/domain/timeline';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** One named row in the Recent workouts list, with the date underneath. */
export function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const router = useRouter();
  const tint =
    entry.kind === 'workout'
      ? colors.primary
      : entry.kind === 'activity'
        ? colors.success
        : colors.textMuted;

  const sub = [
    formatDate(`${entry.date}T12:00:00`),
    entry.durationSeconds > 0 ? formatDurationShort(entry.durationSeconds) : null,
    entry.detail || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        entry.workoutId
          ? router.push(`/workout/${entry.workoutId}`)
          : entry.runId && router.push(`/run/${entry.runId}`)
      }
      disabled={!entry.workoutId && !entry.runId}
    >
      <View style={[styles.kindBar, { backgroundColor: tint }]} />
      <View style={styles.rowMain}>
        <Text style={text.body}>{entry.title}</Text>
        <Text style={text.caption}>{sub}</Text>
      </View>
      {entry.workoutId || entry.runId ? <Text style={styles.chev}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kindBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowMain: { gap: 2, flex: 1 },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
});
