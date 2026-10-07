/**
 * Speaks the spoken updates (src/domain/running/cues.ts) during a run.
 * Called from the GPS task after each batch of fixes, so it works with the
 * phone locked, and checks at most every CHECK_EVERY_MS so a long run costs
 * almost nothing.
 *
 * Speech goes through a separate, system-managed audio session
 * (useApplicationAudioSession: false): iOS lowers any music while it talks
 * and brings it back afterwards, without the app changing its own audio
 * settings.
 */
import * as Speech from 'expo-speech';

import type { ActiveRun } from '@/domain/running/activeRunStore';
import { cueFor } from '@/domain/running/cues';
import { computeSplits } from '@/domain/running/splits';
import { liveStatsAt, prepareLive } from '@/domain/running/summarize';
import { METERS_PER } from '@/domain/running/units';

const CHECK_EVERY_MS = 10_000;

let currentRun: string | null = null;
let announced = 0;
let lastCheck = 0;

export function maybeAnnounce(run: ActiveRun | null, now = Date.now()): void {
  if (!run || run.meta.recorder.status !== 'recording' || run.meta.audioCues === false) return;
  if (now - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now;

  const { autoPause, unit } = run.meta;
  const prepared = prepareLive(run.fixes, autoPause);
  const live = liveStatsAt(prepared, run.meta.recorder, now, { autoPause, unit });

  if (currentRun !== run.meta.runId) {
    // A new run, or the app came back mid-run: start counting from here, so
    // nothing said before a relaunch is said again.
    currentRun = run.meta.runId;
    announced = Math.floor(live.distanceM / METERS_PER[unit]);
    return;
  }

  const cue = cueFor(live.distanceM, live.movingSeconds, computeSplits(prepared.track, METERS_PER[unit]), unit, announced);
  if (!cue) return;
  announced = cue.split;
  Speech.speak(cue.text, { useApplicationAudioSession: false });
}
