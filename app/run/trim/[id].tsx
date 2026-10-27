import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, LoadingView, NumberStepper, Screen, StatTile } from '@/components';
import { RunMap } from '@/components/RunMap';
import { useCropRun, useRun } from '@/data/runs';
import { formatClock } from '@/domain/duration';
import type { RunDetail } from '@/domain/running/detail';
import { cropRun, indexAtDistance, savedTrack } from '@/domain/running/edit';
import type { LatLon } from '@/domain/running/geo';
import { formatDistance, formatPace, METERS_PER, paceSeconds } from '@/domain/running/units';
import { spacing, text } from '@/theme/typography';

/** The steppers move in hundredths of a mile or kilometre. */
const STEP = 0.01;
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function TrimRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const run = useRun(id);
  if (run.data?.trimmable) return <TrimForm run={run.data} />;
  if (run.isPending) return <LoadingView label="Loading run…" />;
  return <EmptyState title="This run can’t be trimmed" message="It has no route saved with distances." />;
}

function TrimForm({ run }: { run: RunDetail }) {
  const router = useRouter();
  const crop = useCropRun();
  const unit = run.unit;
  const per = METERS_PER[unit];
  const track = useMemo(() => savedTrack(run), [run]);
  const total = round2(track[track.length - 1].d / per);

  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(total);
  const from = indexAtDistance(track, start * per);
  const to = indexAtDistance(track, end * per);
  const result = useMemo(() => cropRun(run, from, to), [run, from, to]);

  const kept: LatLon[][] = to > from ? [track.slice(from, to + 1)] : [];
  const faded: LatLon[][] = [
    ...(from > 0 ? [track.slice(0, from + 1)] : []),
    ...(to < track.length - 1 ? [track.slice(to)] : []),
  ];

  const save = async () => {
    if (!result.ok) return;
    try {
      await crop.mutateAsync(result.input);
      router.back();
    } catch (e) {
      Alert.alert('Could not trim', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const message = !result.ok
    ? result.reason === 'unchanged'
      ? 'Move the start or the end to trim the run.'
      : 'That leaves too little of the run. Keep at least 50 metres.'
    : null;

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <RunMap
        segments={kept}
        faded={faded}
        fitToRoute
        style={styles.map}
        accessibilityLabel="Map of the run, with the trimmed parts faded"
      />

      <NumberStepper
        label={`Start at (${unit})`}
        value={start}
        onChange={(v) => setStart(round2(Math.max(0, Math.min(v, end - STEP))))}
        step={STEP}
        min={0}
        max={total}
        precision={2}
        suffix={unit}
      />
      <NumberStepper
        label={`End at (${unit})`}
        value={end}
        onChange={(v) => setEnd(round2(Math.min(total, Math.max(v, start + STEP))))}
        step={STEP}
        min={0}
        max={total}
        precision={2}
        suffix={unit}
      />

      {result.ok ? (
        <View style={styles.tiles}>
          <StatTile value={formatDistance(result.input.p_distance_m, unit)} label="distance kept" />
          <StatTile value={formatClock(result.input.p_moving_seconds)} label="moving time" />
          <StatTile
            value={formatPace(paceSeconds(result.input.p_distance_m, result.input.p_moving_seconds, unit), unit)}
            label="average pace"
          />
        </View>
      ) : (
        <Text style={text.bodyMuted}>{message}</Text>
      )}

      <Text style={text.caption}>
        Splits, best efforts and the charts are worked out again from the part you keep. Calories
        and steps are scaled to it.
      </Text>

      <Button
        label="Save trimmed run"
        size="lg"
        onPress={() => void save()}
        disabled={!result.ok}
        loading={crop.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  map: { height: 260 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
