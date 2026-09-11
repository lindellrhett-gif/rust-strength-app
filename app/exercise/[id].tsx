import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, LoadingView, Pill, StatTile } from '@/components';
import { ProgressChart } from '@/components/ProgressChart';
import { useExercises } from '@/data/exercises';
import { useProfile } from '@/data/profile';
import { useExerciseProgress } from '@/data/sets';
import {
  PROGRESS_METRICS,
  buildProgressSeries,
  progressSummary,
  shortDate,
  type ProgressMetric,
} from '@/domain/progress';
import { compact, trimWeight } from '@/lib/format';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** How many sessions the table underneath lists, newest first. */
const TABLE_ROWS = 12;

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [metric, setMetric] = useState<ProgressMetric>('e1rm');

  const exercises = useExercises();
  const profile = useProfile();
  const sets = useExerciseProgress(id);

  const unit = profile.data?.unit ?? 'lb';
  const exercise = exercises.data?.find((e) => e.id === id) ?? null;

  const series = useMemo(
    () => buildProgressSeries(sets.data ?? [], metric),
    [sets.data, metric],
  );

  const active = PROGRESS_METRICS.find((m) => m.id === metric)!;
  // Volume is a count of weight moved, not a weight you could lift.
  const valueUnit = metric === 'volume' ? `${unit} total` : unit;

  if (sets.isLoading) return <LoadingView />;
  if (!exercise && !exercises.isLoading) return <EmptyState title="Exercise not found" />;

  const recent = [...series.points].reverse().slice(0, TABLE_ROWS);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: exercise?.name ?? 'Progress' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text style={text.title}>{exercise?.name ?? 'Exercise'}</Text>
          {exercise ? <Pill label={exercise.muscle_group} /> : null}
        </View>

        <View style={styles.segment}>
          {PROGRESS_METRICS.map((option) => {
            const on = option.id === metric;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setMetric(option.id)}
                style={[styles.segmentBtn, on && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <ProgressChart series={series} unit={valueUnit} label={active.label} />
        </Card>

        <Text style={text.bodyMuted}>{progressSummary(series, unit)}</Text>
        <Text style={text.caption}>{active.blurb}.</Text>

        {series.points.length > 0 ? (
          <View style={styles.tiles}>
            <StatTile value={fmt(series.best, metric, unit)} label={`best ${active.label.toLowerCase()}`} />
            <StatTile value={fmt(series.latest, metric, unit)} label="most recent" />
            <StatTile value={String(series.points.length)} label="sessions" />
            <StatTile
              value={String((sets.data ?? []).length)}
              label="working sets"
            />
          </View>
        ) : null}

        {/* The table view: every plotted value, readable without the chart. */}
        {recent.length > 0 ? (
          <Card title="Session history">
            <View style={[styles.row, styles.headRow]}>
              <Text style={[styles.cellDate, styles.headCell]}>DATE</Text>
              <Text style={[styles.cellMid, styles.headCell]}>TOP SET</Text>
              <Text style={[styles.cellValue, styles.headCell]}>
                {active.label.toUpperCase()}
              </Text>
            </View>
            {recent.map((point) => (
              <View key={point.date} style={styles.row}>
                <Text style={styles.cellDate}>{shortDate(point.date)}</Text>
                <Text style={styles.cellMid}>
                  {trimWeight(point.topWeight)} × {point.topReps}
                  <Text style={styles.faint}>{`  (${point.sets})`}</Text>
                </Text>
                <Text style={styles.cellValue}>{fmt(point.value, metric, unit)}</Text>
              </View>
            ))}
            {series.points.length > TABLE_ROWS ? (
              <Text style={text.caption}>
                Showing the last {TABLE_ROWS} of {series.points.length} sessions.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Volume runs to five figures, so it is abbreviated; weights are not. */
function fmt(value: number | null, metric: ProgressMetric, unit: string): string {
  if (value == null) return '—';
  return metric === 'volume' ? compact(value) : `${trimWeight(value)} ${unit}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },

  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  segmentTextActive: { color: colors.text },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headRow: { borderTopWidth: 0 },
  headCell: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  // Tabular figures here, where the numbers line up down the column.
  cellDate: { width: 64, color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  cellMid: { flex: 1, color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  cellValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  faint: { color: colors.textFaint, fontSize: 12 },
});
