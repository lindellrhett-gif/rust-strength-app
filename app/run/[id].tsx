import { useMutationState } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingView, Screen, StatTile } from '@/components';
import { RunMap } from '@/components/RunMap';
import { useProfile } from '@/data/profile';
import { useRun, useSaveRun } from '@/data/runs';
import { formatClock } from '@/domain/duration';
import { EFFORT_KEYS, EFFORT_LABEL } from '@/domain/running/bestEfforts';
import type { RunDetail } from '@/domain/running/detail';
import type { SaveRunInput } from '@/domain/running/save';
import { formatDistance, formatElevation, formatPace, paceSeconds, METERS_PER } from '@/domain/running/units';
import { mk } from '@/lib/queryClient';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function RunSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const run = useRun(id);
  const retry = useSaveRun();

  // A run finished moments ago may still be saving, or waiting for signal.
  const saves = useMutationState({
    filters: { mutationKey: mk.saveRun },
    select: (m) => ({
      variables: m.state.variables as SaveRunInput | undefined,
      status: m.state.status,
      isPaused: m.state.isPaused,
      error: m.state.error,
    }),
  });
  const save = [...saves].reverse().find((s) => s.variables?.p_id === id);

  if (run.data) return <RunSummary run={run.data} onDone={() => router.back()} />;

  if (save && save.status === 'pending') {
    return save.isPaused ? (
      <EmptyState
        title="Saved on your phone"
        message="You’re offline, so the run will upload automatically when you have signal again."
      />
    ) : (
      <LoadingView label="Saving your run…" />
    );
  }

  if (save && save.status === 'error' && save.variables) {
    const variables = save.variables;
    return (
      <Screen contentStyle={styles.center}>
        <Text style={text.heading}>Your run didn’t save</Text>
        <Text style={[text.bodyMuted, styles.centerText]}>
          {save.error instanceof Error ? save.error.message : 'Something went wrong.'} It’s still on
          your phone.
        </Text>
        <Button label="Try again" onPress={() => retry.mutate(variables)} loading={retry.isPending} />
      </Screen>
    );
  }

  if (run.isPending) return <LoadingView label="Loading run…" />;
  return <EmptyState title="Run not found" message="It may have been deleted." />;
}

function RunSummary({ run, onDone }: { run: RunDetail; onDone: () => void }) {
  const profile = useProfile();
  const unit = run.unit;
  const segments = useMemo(() => (run.route.length >= 2 ? [run.route] : []), [run.route]);
  const date = new Date(run.performedAt);
  const fastest = run.splits.reduce<number | null>(
    (best, s) => (s.distanceM >= METERS_PER[unit] * 0.99 && (best == null || s.seconds < best) ? s.seconds : best),
    null,
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.titleBlock}>
        <Text style={text.title} accessibilityRole="header">
          {run.name}
        </Text>
        <Text style={text.bodyMuted}>
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} ·{' '}
          {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>

      {segments.length > 0 ? (
        <RunMap segments={segments} fitToRoute style={styles.map} accessibilityLabel="Map of this run’s route" />
      ) : null}

      <View style={styles.tiles}>
        <StatTile value={formatDistance(run.distanceM, unit)} label="distance" />
        <StatTile value={formatClock(run.movingSeconds)} label="moving time" />
        <StatTile value={formatPace(paceSeconds(run.distanceM, run.movingSeconds, unit), unit)} label="average pace" />
        <StatTile value={formatClock(run.elapsedSeconds)} label="elapsed time" />
        {run.hasElevation && run.elevationGainM != null ? (
          <StatTile value={formatElevation(run.elevationGainM, unit)} label="elevation gain" />
        ) : null}
        <StatTile
          value={run.calories != null ? `${run.calories.toLocaleString('en-US')}` : '—'}
          label={run.calories != null ? 'calories (estimate)' : 'add bodyweight for calories'}
        />
      </View>

      {run.splits.length > 0 ? (
        <Card title={unit === 'mi' ? 'Splits per mile' : 'Splits per km'}>
          {run.splits.map((s, i) => {
            const pace = paceSeconds(s.distanceM, s.seconds, unit);
            const isFastest = fastest != null && s.seconds === fastest && s.distanceM >= METERS_PER[unit] * 0.99;
            return (
              <View
                key={i}
                style={styles.splitRow}
                accessible
                accessibilityLabel={`${unit === 'mi' ? 'Mile' : 'Kilometre'} ${i + 1}${s.distanceM < METERS_PER[unit] * 0.99 ? `, partial ${formatDistance(s.distanceM, unit)}` : ''}, pace ${formatPace(pace, unit)}${isFastest ? ', fastest' : ''}`}
              >
                <Text style={[text.body, styles.splitIndex]}>{i + 1}</Text>
                <Text style={[text.body, styles.splitPace, isFastest && { color: colors.success }]}>
                  {formatPace(pace, unit)}
                </Text>
                <Text style={text.caption}>
                  {s.distanceM < METERS_PER[unit] * 0.99 ? formatDistance(s.distanceM, unit) : ''}
                  {s.elevationChangeM != null
                    ? `  ${s.elevationChangeM >= 0 ? '+' : '-'}${formatElevation(Math.abs(s.elevationChangeM), unit)}`
                    : ''}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {EFFORT_KEYS.some((k) => run.bestEfforts[k] != null) ? (
        <Card title="Best efforts in this run">
          {EFFORT_KEYS.filter((k) => run.bestEfforts[k] != null).map((k) => (
            <View key={k} style={styles.splitRow}>
              <Text style={[text.body, styles.flex]}>{EFFORT_LABEL[k]}</Text>
              <Text style={[text.body, styles.splitPace]}>{formatClock(run.bestEfforts[k]!)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {run.calories == null && profile.data && !profile.data.body_weight ? (
        <Text style={text.caption}>
          Calories need your bodyweight. Add it in Profile and future runs will include an estimate.
        </Text>
      ) : null}

      <Button label="Done" size="lg" onPress={onDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { textAlign: 'center' },
  titleBlock: { gap: spacing.xs },
  map: { height: 240 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  splitIndex: { width: 28, color: colors.textMuted },
  splitPace: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
});
