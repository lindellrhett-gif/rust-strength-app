import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { RunMap } from '@/components/RunMap';
import { useProfile } from '@/data/profile';
import { DEFAULT_RUN_PREFERENCES, useRunPreferences, useSaveRun } from '@/data/runs';
import { formatClock } from '@/domain/duration';
import { gpsQuality, routeSegments, type GpsQuality } from '@/domain/running/display';
import { filterFixes } from '@/domain/running/filter';
import { accessMessage, type LocationAccess } from '@/domain/running/permission';
import {
  countdownRemaining,
  initialRecorder,
  reduceRecorder,
  type RecorderEvent,
} from '@/domain/running/recorder';
import { buildSaveRunInput, unsavableReason } from '@/domain/running/save';
import { liveStats, summarizeRun } from '@/domain/running/summarize';
import { runUnitFor, toKilograms, toUnit, type RunDistanceUnit } from '@/domain/running/units';
import { newId } from '@/lib/ids';
import {
  getLocationAccess,
  requestLocationAccess,
  startRunTracking,
  stopRunTracking,
} from '@/lib/runTracker';
import { runStore } from '@/lib/runStore';
import { useActiveRun } from '@/lib/useActiveRun';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** Big numbers grow with Dynamic Type, but never past what fits on screen. */
const BIG_SCALE = 1.3;

const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

const paceText = (secondsPerUnit: number | null) =>
  secondsPerUnit == null || !Number.isFinite(secondsPerUnit) || secondsPerUnit >= 99 * 60
    ? '--:--'
    : formatClock(Math.round(secondsPerUnit));

async function dispatch(event: RecorderEvent): Promise<void> {
  const current = runStore.current();
  if (!current) return;
  const next = reduceRecorder(current.meta.recorder, event);
  if (next !== current.meta.recorder) await runStore.setRecorder(next);
}

export default function RecordRunScreen() {
  const router = useRouter();
  const profile = useProfile();
  const prefsQuery = useRunPreferences();
  const prefs = prefsQuery.data ?? DEFAULT_RUN_PREFERENCES;
  const run = useActiveRun();
  const save = useSaveRun();

  const recorder = run?.meta.recorder ?? initialRecorder;
  const status = recorder.status;
  const unit: RunDistanceUnit = run?.meta.unit ?? runUnitFor(profile.data?.unit ?? 'lb');
  const autoPause = run?.meta.autoPause ?? prefs.autoPause;

  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [previewAccuracy, setPreviewAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Location access, and again when coming back from the Settings app.
  useEffect(() => {
    let alive = true;
    const check = () => {
      getLocationAccess()
        .then((a) => alive && setAccess(a))
        .catch(() => alive && setAccess('denied'));
    };
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Before the run: watch GPS so the runner can wait for a good signal.
  useEffect(() => {
    if (access !== 'granted' || status !== 'idle') return;
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (l) => setPreviewAccuracy(l.coords.accuracy ?? null),
    )
      .then((s) => {
        if (alive) sub = s;
        else s.remove();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [access, status]);

  // The clock. During the countdown it also starts the run when it hits zero.
  useEffect(() => {
    if (status !== 'countdown' && status !== 'recording' && status !== 'paused') return;
    const id = setInterval(
      () => {
        const t = Date.now();
        setNow(t);
        const current = runStore.current();
        const rec = current?.meta.recorder;
        if (rec?.status === 'countdown' && rec.countdownEndsAt != null && t >= rec.countdownEndsAt) {
          void dispatch({ type: 'tick', now: t });
          Vibration.vibrate(300);
          announce('Go');
        }
      },
      status === 'countdown' ? 200 : 1000,
    );
    return () => clearInterval(id);
  }, [status]);

  const live = useMemo(
    () => (run ? liveStats(run.fixes, recorder, now, { autoPause, unit }) : null),
    [run, recorder, now, autoPause, unit],
  );
  const segments = useMemo(() => routeSegments(filterFixes(run?.fixes ?? []).fixes), [run?.fixes]);

  // Tell VoiceOver when auto-pause kicks in or lets go.
  const lastAutoPaused = useRef(false);
  const autoPaused = live?.autoPaused ?? false;
  useEffect(() => {
    if (autoPaused !== lastAutoPaused.current) {
      lastAutoPaused.current = autoPaused;
      announce(autoPaused ? 'Auto-paused' : 'Moving again');
    }
  }, [autoPaused]);

  const lastFix = run?.fixes[run.fixes.length - 1];
  const quality: GpsQuality =
    status === 'idle'
      ? gpsQuality(previewAccuracy)
      : lastFix && now - lastFix.t < 15_000
        ? gpsQuality(lastFix.accuracy)
        : status === 'recording' && autoPaused
          ? 'good'
          : 'searching';

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let a = access;
      if (a === 'undetermined' || a === null) {
        a = await requestLocationAccess();
        setAccess(a);
      }
      if (a !== 'granted') return;
      const runId = newId();
      const bodyweight = profile.data?.body_weight;
      await runStore.start({
        runId,
        recorder: reduceRecorder(initialRecorder, { type: 'start', now: Date.now() }),
        unit,
        autoPause: prefs.autoPause,
        bodyweightKg: bodyweight ? toKilograms(bodyweight, profile.data?.unit ?? 'lb') : null,
        mapVisibility: prefs.mapDefault,
      });
      try {
        // Started during the countdown so GPS is warm by "Go".
        await startRunTracking();
      } catch (e) {
        await runStore.clear(runId);
        Alert.alert('GPS could not start', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelCountdown = async () => {
    await stopRunTracking();
    await runStore.clear();
  };

  const pause = () => {
    void dispatch({ type: 'pause', now: Date.now() });
    announce('Paused');
  };

  const resume = () => {
    void dispatch({ type: 'resume', now: Date.now() });
    announce('Recording');
  };

  const discard = async (runId: string) => {
    await stopRunTracking();
    await runStore.clear(runId);
    router.back();
  };

  const finish = async () => {
    const current = runStore.current();
    if (!current || busy) return;
    setBusy(true);
    try {
      const rec =
        current.meta.recorder.status === 'finished'
          ? current.meta.recorder
          : reduceRecorder(current.meta.recorder, { type: 'finish', now: Date.now() });
      const summary = summarizeRun(current.fixes, rec, {
        autoPause: current.meta.autoPause,
        unit: current.meta.unit,
        bodyweightKg: current.meta.bodyweightKg,
      });
      const reason = unsavableReason(summary);
      if (reason) {
        Alert.alert(
          'Too short to save',
          reason === 'too-short' ? 'This run is under 50 metres.' : 'No GPS route was recorded.',
          [
            ...(rec === current.meta.recorder ? [] : [{ text: 'Keep recording', style: 'cancel' as const }]),
            { text: 'Discard run', style: 'destructive', onPress: () => void discard(current.meta.runId) },
          ],
        );
        return;
      }
      await runStore.setRecorder(rec);
      await stopRunTracking();
      announce('Run finished');
      save.mutate(
        buildSaveRunInput(summary, {
          runId: current.meta.runId,
          startedAt: rec.startedAt ?? Date.now(),
          unit: current.meta.unit,
          mapVisibility: current.meta.mapVisibility,
        }),
      );
      router.replace(`/run/${current.meta.runId}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = () =>
    Alert.alert('Finish run?', 'You can review and edit it afterwards.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: () => void finish() },
    ]);

  const message = access ? accessMessage(access) : null;
  const distance = toUnit(live?.distanceM ?? 0, unit);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        {status === 'idle' ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
          >
            <Text style={styles.close}>Close</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={text.heading} accessibilityRole="header">
          {status === 'paused' ? 'Paused' : status === 'recording' ? 'Running' : 'Run'}
        </Text>
        <GpsPill quality={quality} autoPaused={status === 'recording' && autoPaused} />
      </View>

      {message ? (
        <View style={styles.notice}>
          <Text style={text.heading}>{message.title}</Text>
          <Text style={text.bodyMuted}>{message.body}</Text>
          {message.settings ? (
            <Button label="Open Settings" onPress={() => Linking.openSettings().catch(() => undefined)} />
          ) : null}
        </View>
      ) : access === 'undetermined' && status === 'idle' ? (
        <View style={styles.notice}>
          <Text style={text.heading}>Your location, only while you run</Text>
          <Text style={text.bodyMuted}>
            Rust Strength uses your location while you record a run, to measure distance, pace and
            your route. Nothing is tracked when you are not recording.
          </Text>
        </View>
      ) : (
        <RunMap
          segments={segments}
          follow={status !== 'idle'}
          showsUser
          style={styles.map}
          accessibilityLabel={
            segments.length > 0 ? 'Map of your route so far' : 'Map showing your current location'
          }
        />
      )}

      {status === 'finished' ? (
        <View style={styles.stats}>
          <Text style={text.heading}>This run hasn’t been saved yet</Text>
          <Text style={text.bodyMuted}>It was recorded but the app closed before saving.</Text>
        </View>
      ) : (
        <View style={styles.stats}>
          <View
            accessible
            accessibilityLabel={`Time ${formatClock(live?.movingSeconds ?? 0)}`}
            style={styles.timeBlock}
          >
            <Text style={styles.time} maxFontSizeMultiplier={BIG_SCALE} adjustsFontSizeToFit numberOfLines={1}>
              {formatClock(live?.movingSeconds ?? 0)}
            </Text>
            <Text style={text.label}>TIME</Text>
          </View>
          <View style={styles.row}>
            <Stat
              value={distance.toFixed(2)}
              label={unit === 'mi' ? 'MILES' : 'KM'}
              spoken={`Distance ${distance.toFixed(2)} ${unit === 'mi' ? 'miles' : 'kilometres'}`}
            />
            <Stat
              value={paceText(live?.currentPace ?? null)}
              label={`PACE /${unit}`}
              spoken={`Current pace ${paceText(live?.currentPace ?? null)} per ${unit === 'mi' ? 'mile' : 'kilometre'}`}
            />
            <Stat
              value={paceText(live?.averagePace ?? null)}
              label={`AVG /${unit}`}
              spoken={`Average pace ${paceText(live?.averagePace ?? null)} per ${unit === 'mi' ? 'mile' : 'kilometre'}`}
            />
          </View>
        </View>
      )}

      <View style={styles.controls}>
        {status === 'idle' ? (
          message ? null : (
            <Button
              label={access === 'undetermined' ? 'Allow location and start' : 'Start'}
              size="lg"
              onPress={() => void start()}
              loading={busy}
            />
          )
        ) : status === 'recording' || status === 'paused' ? (
          <View style={styles.controlRow}>
            {status === 'recording' ? (
              <Button label="Pause" variant="secondary" size="lg" onPress={pause} style={styles.flex} />
            ) : (
              <Button label="Resume" size="lg" onPress={resume} style={styles.flex} />
            )}
            <Pressable
              onPress={confirmFinish}
              onLongPress={() => void finish()}
              delayLongPress={800}
              accessibilityRole="button"
              accessibilityLabel="Finish run"
              accessibilityHint="Asks you to confirm. Press and hold to finish straight away."
              style={({ pressed }) => [styles.finish, pressed && styles.finishPressed]}
            >
              <Text style={styles.finishText}>Finish</Text>
              <Text style={styles.finishHint}>hold</Text>
            </Pressable>
          </View>
        ) : status === 'finished' && run ? (
          <View style={styles.controlRow}>
            <Button
              label="Discard"
              variant="danger"
              size="lg"
              onPress={() => void discard(run.meta.runId)}
              style={styles.flex}
            />
            <Button label="Save run" size="lg" onPress={() => void finish()} loading={busy} style={styles.flex} />
          </View>
        ) : null}
      </View>

      {status === 'countdown' ? (
        <Pressable
          style={styles.countdown}
          onPress={() => void dispatch({ type: 'skipCountdown', now: Date.now() })}
          accessibilityRole="button"
          accessibilityLabel={`Starting in ${countdownRemaining(recorder, now)}. Double tap to start now.`}
        >
          <Text style={styles.countdownNumber} maxFontSizeMultiplier={1}>
            {Math.max(1, countdownRemaining(recorder, now))}
          </Text>
          <Text style={text.bodyMuted}>Tap to start now</Text>
          <Button label="Cancel" variant="ghost" onPress={() => void cancelCountdown()} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function Stat({ value, label, spoken }: { value: string; label: string; spoken: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={spoken}>
      <Text style={styles.statValue} maxFontSizeMultiplier={BIG_SCALE} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      <Text style={text.label}>{label}</Text>
    </View>
  );
}

function GpsPill({ quality, autoPaused }: { quality: GpsQuality; autoPaused: boolean }) {
  const label = autoPaused
    ? 'Auto-paused'
    : quality === 'good'
      ? 'GPS ready'
      : quality === 'weak'
        ? 'Weak GPS'
        : 'Finding GPS';
  const tint = autoPaused ? colors.warning : quality === 'good' ? colors.success : quality === 'weak' ? colors.warning : colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: tint }]} accessible accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.pillText, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  close: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  notice: {
    flex: 1,
    margin: spacing.lg,
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  map: { flex: 1, marginHorizontal: spacing.lg },
  stats: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  timeBlock: { alignItems: 'center' },
  time: { fontSize: 72, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statValue: { fontSize: 30, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  controls: { padding: spacing.lg, gap: spacing.sm },
  controlRow: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  finish: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.danger,
    paddingVertical: spacing.sm,
  },
  finishPressed: { backgroundColor: colors.danger },
  finishText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  finishHint: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  countdown: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 13, 16, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  countdownNumber: { fontSize: 160, fontWeight: '900', color: colors.primary, fontVariant: ['tabular-nums'] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
