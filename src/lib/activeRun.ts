/**
 * Finishing and discarding the run in progress, shared by the recording
 * screen and the prompt that appears when the app reopens with a run still
 * on the phone. The decisions are pure (src/domain/running/finish.ts); this
 * file does the I/O around them.
 */
import { prepareFinish } from '@/domain/running/finish';
import { recordingIntervals } from '@/domain/running/recorder';
import { buildSaveRunInput, type SaveRunInput } from '@/domain/running/save';

import { stopRunTracking } from './runTracker';
import { runStore } from './runStore';
import { stepsDuringWithin } from './steps';

/** A slow pedometer answer never holds up saving the run. */
const STEPS_SAVE_TIMEOUT_MS = 2500;

export type FinishOutcome =
  | { kind: 'ready'; runId: string; input: SaveRunInput }
  | { kind: 'too-short' | 'no-route'; runId: string };

/**
 * Ends the run in progress at `finishAt`: stops GPS, marks it finished on the
 * phone (so it survives the app closing before the save goes through), and
 * returns the save for the caller to send through the offline queue. A run
 * too short to keep is left exactly as it was, so the runner can carry on.
 */
export async function finishActiveRun(finishAt: number): Promise<FinishOutcome | null> {
  const run = runStore.current();
  if (!run) return null;
  const runId = run.meta.runId;

  const prepared = prepareFinish(run, finishAt);
  if (!prepared.ok) return { kind: prepared.reason, runId };

  const { recorder, summary } = prepared;
  const end = recorder.finishedAt ?? finishAt;
  await runStore.setRecorder(recorder);
  await stopRunTracking();
  const steps = await stepsDuringWithin(recordingIntervals(recorder, end), STEPS_SAVE_TIMEOUT_MS);
  return {
    kind: 'ready',
    runId,
    input: buildSaveRunInput(summary, {
      runId,
      startedAt: recorder.startedAt ?? end,
      unit: run.meta.unit,
      mapVisibility: run.meta.mapVisibility,
      steps,
      routeId: run.meta.routeId ?? null,
    }),
  };
}

/** Stops GPS and deletes the run from the phone. With an id, only that run. */
export async function discardActiveRun(runId?: string): Promise<void> {
  await stopRunTracking();
  await runStore.clear(runId);
}

/**
 * Removes a run recorded by another account. Called when someone signs in,
 * so one person's route never stays on the phone under somebody else.
 */
export async function discardRunsNotOwnedBy(userId: string): Promise<void> {
  const run = await runStore.load();
  if (run && run.meta.userId != null && run.meta.userId !== userId) await discardActiveRun(run.meta.runId);
}
