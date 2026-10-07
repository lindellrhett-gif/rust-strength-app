import { useMutationState } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingView, Screen, StatTile } from '@/components';
import { RunChart } from '@/components/RunChart';
import { RunMap } from '@/components/RunMap';
import { useProfile } from '@/data/profile';
import { useRun, useSaveRun, useUpdateRunDetails } from '@/data/runs';
import { formatClock } from '@/domain/duration';
import { EFFORT_KEYS, EFFORT_LABEL } from '@/domain/running/bestEfforts';
import { elevationSeries, paceSeries } from '@/domain/running/charts';
import { parseRunRow, runRowFromSave, type RunDetail } from '@/domain/running/detail';
import { effortLabel, savedTrack } from '@/domain/running/edit';
import type { SaveRunInput } from '@/domain/running/save';
import { cadence } from '@/domain/running/steps';
import { formatDistance, formatElevation, formatPace, paceSeconds, METERS_PER } from '@/domain/running/units';
import { mk } from '@/lib/queryClient';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

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
  const pendingInput = save?.status === 'pending' ? save.variables : undefined;
  const pending = useMemo(
    () => (pendingInput ? parseRunRow(runRowFromSave(pendingInput)) : null),
    [pendingInput],
  );

  if (run.data) {
    const runId = run.data.id;
    return (
      <>
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable
                onPress={() => router.push(`/run/edit/${runId}`)}
                accessibilityRole="button"
                accessibilityLabel="Edit run"
                hitSlop={12}
              >
                <Text style={styles.headerButton}>Edit</Text>
              </Pressable>
            ),
          }}
        />
        <RunSummary
          run={run.data}
          onDone={() => router.back()}
          sharing={<RunSharing run={run.data} onPrivacyZones={() => router.push('/run/privacy-zones')} />}
        />
      </>
    );
  }

  // Still in the offline queue: show it as it will look once it arrives.
  if (pending) {
    return (
      <RunSummary
        run={pending}
        onDone={() => router.back()}
        banner={
          save?.isPaused
            ? 'Saved on your phone. It uploads when you’re back online, and you can edit it then.'
            : 'Saving your run…'
        }
      />
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

/**
 * Who sees this run. Friends get stats only unless the map is shared, and a
 * shared map is trimmed on the server (see migration 0021).
 */
function RunSharing({ run, onPrivacyZones }: { run: RunDetail; onPrivacyZones: () => void }) {
  const update = useUpdateRunDetails();
  // While a change is on its way, show it rather than the old value.
  const pending = update.isPending ? update.variables : undefined;
  const shared = pending?.shareToFeed ?? run.shareToFeed;
  const mapShared = (pending?.mapVisibility ?? run.mapVisibility) === 'friends';

  const change = (patch: { shareToFeed?: boolean; mapVisibility?: 'private' | 'friends' }) =>
    update.mutate(
      { id: run.id, title: run.title, note: run.note, effort: run.effort, ...patch },
      {
        onError: (e) =>
          Alert.alert('Could not change sharing', e instanceof Error ? e.message : 'Please try again.'),
      },
    );

  return (
    <Card title="Sharing">
      <View style={styles.switchRow}>
        <Text style={[text.body, styles.flex]}>Share to friends’ feed</Text>
        <Switch
          value={shared}
          onValueChange={(v) => change({ shareToFeed: v })}
          accessibilityLabel="Share to friends’ feed"
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={[text.body, styles.flex, !shared && styles.dim]}>Show the map to friends</Text>
        <Switch
          value={shared && mapShared}
          disabled={!shared}
          onValueChange={(v) => change({ mapVisibility: v ? 'friends' : 'private' })}
          accessibilityLabel="Show the map to friends"
        />
      </View>
      <Text style={text.caption}>
        {shared
          ? mapShared
            ? 'Friends see your stats and the route, minus the first and last 200 m and anything inside your privacy zones.'
            : 'Friends see your distance, time and pace. Not the map.'
          : 'Only you can see this run.'}
      </Text>
      <Pressable onPress={onPrivacyZones} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.link}>Privacy zones ›</Text>
      </Pressable>
    </Card>
  );
}

function RunSummary({
  run,
  onDone,
  banner,
  sharing,
}: {
  run: RunDetail;
  onDone: () => void;
  banner?: string;
  sharing?: ReactNode;
}) {
  const profile = useProfile();
  const unit = run.unit;
  const segments = useMemo(() => (run.route.length >= 2 ? [run.route] : []), [run.route]);
  const track = useMemo(() => savedTrack(run), [run]);
  const pace = useMemo(() => paceSeries(track, unit), [track, unit]);
  const elevation = useMemo(
    () => (run.hasElevation ? elevationSeries(track, unit) : []),
    [run.hasElevation, track, unit],
  );
  const date = new Date(run.performedAt);
  const spm = cadence(run.steps, run.movingSeconds);
  const fastest = run.splits.reduce<number | null>(
    (best, s) => (s.distanceM >= METERS_PER[unit] * 0.99 && (best == null || s.seconds < best) ? s.seconds : best),
    null,
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      {banner ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={text.body}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.titleBlock}>
        <Text style={text.title} accessibilityRole="header">
          {run.name}
        </Text>
        <Text style={text.bodyMuted}>
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} ·{' '}
          {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          {run.effort != null ? ` · Effort ${run.effort}/10, ${effortLabel(run.effort).toLowerCase()}` : ''}
        </Text>
        {run.note ? <Text style={text.body}>{run.note}</Text> : null}
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
        {run.steps != null && run.steps > 0 ? (
          <StatTile value={run.steps.toLocaleString('en-US')} label="steps" />
        ) : null}
        {spm != null ? <StatTile value={String(spm)} label="cadence (steps/min)" /> : null}
      </View>

      {pace.length > 0 || elevation.length > 0 ? (
        <Card>
          <RunChart points={pace} kind="pace" unit={unit} title="Pace" />
          <RunChart points={elevation} kind="elevation" unit={unit} title="Elevation" />
        </Card>
      ) : null}

      {run.splits.length > 0 ? (
        <Card title={unit === 'mi' ? 'Splits per mile' : 'Splits per km'}>
          {run.splits.map((s, i) => {
            const splitPace = paceSeconds(s.distanceM, s.seconds, unit);
            const isFastest = fastest != null && s.seconds === fastest && s.distanceM >= METERS_PER[unit] * 0.99;
            return (
              <View
                key={i}
                style={styles.splitRow}
                accessible
                accessibilityLabel={`${unit === 'mi' ? 'Mile' : 'Kilometre'} ${i + 1}${s.distanceM < METERS_PER[unit] * 0.99 ? `, partial ${formatDistance(s.distanceM, unit)}` : ''}, pace ${formatPace(splitPace, unit)}${isFastest ? ', fastest' : ''}`}
              >
                <Text style={[text.body, styles.splitIndex]}>{i + 1}</Text>
                <Text style={[text.body, styles.splitPace, isFastest && { color: colors.success }]}>
                  {formatPace(splitPace, unit)}
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

      {sharing}

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
  headerButton: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  banner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  titleBlock: { gap: spacing.xs },
  map: { height: 240 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  splitIndex: { width: 28, color: colors.textMuted },
  splitPace: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  dim: { color: colors.textFaint },
  link: { color: colors.primary, fontWeight: '600' },
});
