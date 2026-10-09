import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { RunMap } from '@/components/RunMap';
import { SelectSheet } from '@/components/SelectSheet';
import { useProfile } from '@/data/profile';
import { useSavedRoute, useSavedRoutes } from '@/data/routes';
import { DEFAULT_RUN_PREFERENCES, useRunPreferences, useSaveRun } from '@/data/runs';
import { formatClock } from '@/domain/duration';
import { gpsQuality, liveRefreshMs, routeSegments, type GpsQuality } from '@/domain/running/display';
import type { LatLon } from '@/domain/running/geo';
import { accessMessage, type LocationAccess } from '@/domain/running/permission';
import {
  countdownRemaining,
  initialRecorder,
  recordingIntervals,
  reduceRecorder,
  type RecorderEvent,
} from '@/domain/running/recorder';
import { UNSAVABLE_MESSAGE } from '@/domain/running/finish';
import { cadence } from '@/domain/running/steps';
import { liveStatsAt, prepareLive } from '@/domain/running/summarize';
import { formatPaceValue, runUnitFor, toKilograms, toUnit, type RunDistanceUnit } from '@/domain/running/units';
import { discardActiveRun, finishActiveRun } from '@/lib/activeRun';
import { newId } from '@/lib/ids';
import { getLocationAccess, requestLocationAccess, startRunTracking } from '@/lib/runTracker';
import { runStore } from '@/lib/runStore';
import { getStepAccess, requestStepAccess, stepsDuring } from '@/lib/steps';
import { useActiveRun } from '@/lib/useActiveRun';
import { useAppActive } from '@/lib/useAppActive';
import { useThrottled } from '@/lib/useThrottled';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** Big numbers grow with Dynamic Type, but never past what fits on screen. */
const BIG_SCALE = 1.3;
/** How often the step count refreshes while recording. */
const STEPS_REFRESH_MS = 5000;
/** "Go" is only announced if the run started this recently, not on coming back to the app. */
const GO_ANNOUNCE_WINDOW_MS = 2000;

const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

const paceText = formatPaceValue;

async function dispatch(event: RecorderEvent): Promise<void> {
  const current = runStore.current();
  if (!current) return;
  const next = reduceRecorder(current.meta.recorder, event);
  if (next !== current.meta.recorder) await runStore.setRecorder(next);
}

export default function RecordRunScreen() {
  const router = useRouter();
  // Real padding from the root's insets, not a SafeAreaView: this screen is a
  // full-screen modal, where a native safe-area view can miss the Dynamic
  // Island (see ModalScreen).
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ routeId?: string }>();
  const { userId } = useAuth();
  const profile = useProfile();
  const prefsQuery = useRunPreferences();
  const prefs = prefsQuery.data ?? DEFAULT_RUN_PREFERENCES;
  // Battery: with the phone locked nobody can see this screen, so it stops
  // following every fix and stops its clock. GPS keeps recording in the
  // background task either way, and the screen catches up when it is back.
  const appActive = useAppActive();
  const run = useActiveRun({ paused: !appActive });
  const save = useSaveRun();

  const recorder = run?.meta.recorder ?? initialRecorder;
  const status = recorder.status;
  const underway = status === 'countdown' || status === 'recording' || status === 'paused';
  const unit: RunDistanceUnit = run?.meta.unit ?? runUnitFor(profile.data?.unit ?? 'lb');
  const autoPause = run?.meta.autoPause ?? prefs.autoPause;

  const [access, setAccess] = useState<LocationAccess | null>(null);
  /** Where the phone is before the run starts, and how sure it is. */
  const [preview, setPreview] = useState<(LatLon & { accuracy: number | null }) | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);
  // A saved route to follow: chosen before the start, then kept with the run.
  const [chosenRoute, setChosenRoute] = useState<string | null>(params.routeId ?? null);
  const [pickingRoute, setPickingRoute] = useState(false);
  const routes = useSavedRoutes();
  const followedRouteId = status === 'idle' ? chosenRoute : (run?.meta.routeId ?? null);
  const guide = useSavedRoute(followedRouteId ?? undefined);
  const guideLine = useMemo(() => (guide.data?.line.length ? [guide.data.line] : []), [guide.data]);

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

  // Before the run: watch GPS so the runner can wait for a good signal. The
  // last known position puts the map in the right place straight away.
  useEffect(() => {
    if (access !== 'granted' || status !== 'idle') return;
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    Location.getLastKnownPositionAsync()
      .then((l) => {
        if (alive && l) {
          setPreview((p) => p ?? { lat: l.coords.latitude, lon: l.coords.longitude, accuracy: null });
        }
      })
      .catch(() => undefined);
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (l) => setPreview({ lat: l.coords.latitude, lon: l.coords.longitude, accuracy: l.coords.accuracy ?? null }),
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

  // A run that was under way when the app closed: make sure GPS is back on.
  // Harmless if it never stopped.
  useEffect(() => {
    if (access === 'granted' && underway) startRunTracking().catch(() => undefined);
  }, [access, underway]);

  // The clock, only while the screen can be seen. During the countdown it
  // also starts the run when it hits zero (the store does the same from the
  // first fix after it, for when the phone is locked).
  useEffect(() => {
    if (!underway || !appActive) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const rec = runStore.current()?.meta.recorder;
      if (rec?.status === 'countdown' && rec.countdownEndsAt != null && t >= rec.countdownEndsAt) {
        void dispatch({ type: 'tick', now: t });
      }
    };
    // Straight away on coming back to the screen, then on the interval.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, status === 'countdown' ? 200 : 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [status, underway, appActive]);

  // "Go", the moment the countdown ends.
  const lastStatus = useRef(status);
  useEffect(() => {
    const started = recorder.startedAt;
    if (lastStatus.current === 'countdown' && status === 'recording' && started != null) {
      if (Date.now() - started < GO_ANNOUNCE_WINDOW_MS) {
        Vibration.vibrate(300);
        announce('Go');
      }
    }
    lastStatus.current = status;
  }, [status, recorder.startedAt]);

  // Steps so far, from the phone's pedometer, while the run is under way.
  useEffect(() => {
    if ((status !== 'recording' && status !== 'paused') || !appActive) return;
    let alive = true;
    const read = async () => {
      const rec = runStore.current()?.meta.recorder;
      if (!rec) return;
      const n = await stepsDuring(recordingIntervals(rec, Date.now()));
      if (alive) setSteps(n);
    };
    void read();
    const id = setInterval(() => void read(), STEPS_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status, appActive]);

  // The heavy work once per new fix (less often on a long run); the clock
  // only redoes the cheap part.
  const fixes = useThrottled(run?.fixes, liveRefreshMs(run?.fixes.length ?? 0));
  const prepared = useMemo(() => (fixes ? prepareLive(fixes, autoPause) : null), [fixes, autoPause]);
  const live = useMemo(
    () => (prepared ? liveStatsAt(prepared, recorder, now, { autoPause, unit }) : null),
    [prepared, recorder, now, autoPause, unit],
  );
  const segments = useMemo(() => (prepared ? routeSegments(prepared.fixes) : []), [prepared]);

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
  const position: LatLon | null = status !== 'idle' && lastFix ? lastFix : preview;
  const quality: GpsQuality =
    status === 'idle'
      ? gpsQuality(preview?.accuracy)
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
      // Steps are a bonus: whatever the answer, the run goes ahead.
      if ((await getStepAccess()) === 'undetermined') await requestStepAccess();
      setSteps(null);
      const runId = newId();
      const bodyweight = profile.data?.body_weight;
      await runStore.start({
        runId,
        userId,
        recorder: reduceRecorder(initialRecorder, { type: 'start', now: Date.now() }),
        unit,
        autoPause: prefs.autoPause,
        audioCues: prefs.audioCues,
        routeId: chosenRoute,
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

  const cancelCountdown = () => discardActiveRun();

  const pause = () => {
    void dispatch({ type: 'pause', now: Date.now() });
    announce('Paused');
  };

  const resume = () => {
    void dispatch({ type: 'resume', now: Date.now() });
    announce('Recording');
  };

  const discard = async (runId: string) => {
    await discardActiveRun(runId);
    router.back();
  };

  const finish = async () => {
    if (busy) return;
    const alreadyFinished = runStore.current()?.meta.recorder.status === 'finished';
    setBusy(true);
    try {
      const outcome = await finishActiveRun(Date.now());
      if (!outcome) return;
      if (outcome.kind !== 'ready') {
        Alert.alert('Too short to save', UNSAVABLE_MESSAGE[outcome.kind], [
          ...(alreadyFinished ? [] : [{ text: 'Keep recording', style: 'cancel' as const }]),
          { text: 'Discard run', style: 'destructive', onPress: () => void discard(outcome.runId) },
        ]);
        return;
      }
      announce('Run finished');
      save.mutate(outcome.input);
      router.replace(`/run/${outcome.runId}`);
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
  const spm = cadence(steps, live?.movingSeconds ?? 0);

  return (
    <View
      style={[
        styles.safe,
        { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
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
          faded={guideLine}
          position={position}
          follow
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
          {steps != null && steps > 0 ? (
            <Text
              style={[text.bodyMuted, styles.steps]}
              accessibilityLabel={`${steps.toLocaleString('en-US')} steps${spm != null ? `, cadence ${spm} steps per minute` : ''}`}
            >
              {steps.toLocaleString('en-US')} steps{spm != null ? ` · ${spm} spm` : ''}
            </Text>
          ) : null}
        </View>
      )}

      {followedRouteId || (status === 'idle' && !message && (routes.data?.length ?? 0) > 0) ? (
        <Pressable
          style={styles.routeRow}
          onPress={status === 'idle' ? () => setPickingRoute(true) : undefined}
          disabled={status !== 'idle'}
          accessibilityRole={status === 'idle' ? 'button' : undefined}
          accessibilityLabel={
            guide.data ? `Following ${guide.data.name}${status === 'idle' ? '. Double tap to change.' : ''}` : 'Follow a saved route'
          }
        >
          <Text style={text.bodyMuted} numberOfLines={1}>
            {guide.data ? `Following: ${guide.data.name}` : 'Follow a saved route'}
          </Text>
          {status === 'idle' ? <Text style={styles.routeChange}>{guide.data ? 'Change' : '›'}</Text> : null}
        </Pressable>
      ) : null}

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

      <SelectSheet
        visible={pickingRoute}
        title="Follow a saved route"
        options={[
          { id: '', label: 'No route', sublabel: 'Just run' },
          ...(routes.data ?? []).map((r) => ({ id: r.id, label: r.name, sublabel: toUnit(r.distanceM, unit).toFixed(2) + ' ' + unit })),
        ]}
        onSelect={(id) => {
          setPickingRoute(false);
          setChosenRoute(id || null);
        }}
        onClose={() => setPickingRoute(false)}
      />

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
    </View>
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
  steps: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  controls: { padding: spacing.lg, gap: spacing.sm },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    minHeight: 40,
  },
  routeChange: { color: colors.primary, fontWeight: '600' },
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
