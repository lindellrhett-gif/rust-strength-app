/**
 * Ending a run in progress: what to offer when the app starts and finds one
 * on the phone, and turning a run into something to save. Pure, no I/O; the
 * screens do the asking and src/lib/activeRun.ts does the saving.
 */

import type { ActiveRun } from './activeRunStore';
import { reduceRecorder, type RecorderState } from './recorder';
import { unsavableReason } from './save';
import { summarizeRun, type RunSummary } from './summarize';

/**
 * What to do with a run found on the phone when the app starts.
 *   - resume:  it was recording or paused when the app closed. Offer to
 *              carry on, finish it now, or discard it.
 *   - save:    it was finished but never saved. Offer to save or discard.
 *   - discard: nothing worth keeping (the app closed during the countdown),
 *              or it belongs to a different account. Removed without asking:
 *              one person's route is never shown to someone else.
 *   - none:    no run.
 */
export type Recovery = 'none' | 'resume' | 'save' | 'discard';

export function recoveryFor(run: ActiveRun | null, userId: string | null): Recovery {
  if (!run) return 'none';
  if (run.meta.userId != null && run.meta.userId !== userId) return 'discard';
  switch (run.meta.recorder.status) {
    case 'recording':
    case 'paused':
      return 'resume';
    case 'finished':
      return 'save';
    default:
      return 'discard';
  }
}

/**
 * When a run the app lost track of really ended: the last moment it was
 * recording before this launch. Anything recorded after the app came back
 * (GPS can restart on its own when the app opens) is wherever the phone is
 * now, not part of the run.
 */
export function lastRecordedBefore(run: ActiveRun, launchedAt: number): number {
  const rec = run.meta.recorder;
  let end: number | null = rec.status === 'paused' ? rec.pausedAt : null;
  for (const f of run.fixes) {
    if (f.t < launchedAt && (end == null || f.t > end)) end = f.t;
  }
  return end ?? rec.startedAt ?? launchedAt;
}

/** Why a run can't be saved, in the runner's words. */
export const UNSAVABLE_MESSAGE: Record<'too-short' | 'no-route', string> = {
  'too-short': 'This run is under 50 metres.',
  'no-route': 'No GPS route was recorded.',
};

export type PreparedFinish =
  | { ok: true; recorder: RecorderState; summary: RunSummary }
  | { ok: false; reason: 'too-short' | 'no-route' };

/**
 * The run as it would be saved if it finished at `finishAt`. A run that is
 * already finished keeps its own finish time. Fixes after the finish are left
 * out. Nothing is changed: the caller decides whether to go ahead.
 */
export function prepareFinish(run: ActiveRun, finishAt: number): PreparedFinish {
  const current = run.meta.recorder;
  const recorder =
    current.status === 'finished' ? current : reduceRecorder(current, { type: 'finish', now: finishAt });
  const end = recorder.finishedAt ?? finishAt;
  const summary = summarizeRun(
    run.fixes.filter((f) => f.t <= end),
    recorder,
    { autoPause: run.meta.autoPause, unit: run.meta.unit, bodyweightKg: run.meta.bodyweightKg },
  );
  const reason = unsavableReason(summary);
  return reason ? { ok: false, reason } : { ok: true, recorder, summary };
}
