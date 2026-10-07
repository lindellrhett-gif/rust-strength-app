/**
 * A run entered by hand: on a treadmill, or outdoors without the phone.
 * Pure, no I/O. It goes through the same save as a recorded run, with no
 * route, so it counts toward distance, the weekly goal and the streak, but
 * has no map, splits or best efforts (there is nothing to measure them from).
 */

import { estimateCalories } from './calories';
import type { SaveRunInput } from './save';
import { fromUnit, type RunDistanceUnit } from './units';
import { validateRun } from './validate';

export interface ManualRunDraft {
  source: 'manual' | 'treadmill';
  /** In miles or kilometres, as typed. */
  distance: number;
  unit: RunDistanceUnit;
  movingSeconds: number;
  performedAt: Date;
  title: string;
  note: string;
  effort: number | null;
  bodyweightKg: number | null;
  mapVisibility: 'private' | 'friends';
}

export type ManualRunResult = { ok: true; input: SaveRunInput } | { ok: false; error: string };

/** The default title, when none was typed. */
export const manualRunTitle = (source: ManualRunDraft['source']) =>
  source === 'treadmill' ? 'Treadmill run' : 'Run';

export function buildManualRunInput(draft: ManualRunDraft, runId: string, now = Date.now()): ManualRunResult {
  const distanceM = Math.round(fromUnit(draft.distance, draft.unit) * 10) / 10;
  const movingSeconds = Math.round(draft.movingSeconds);
  const check = validateRun({
    distanceM,
    movingSeconds,
    effort: draft.effort,
    title: draft.title,
    note: draft.note,
  });
  if (!check.ok) return { ok: false, error: check.error ?? 'Check the run.' };
  if (!(draft.performedAt.getTime() <= now + 60_000)) {
    return { ok: false, error: 'That start time is in the future.' };
  }

  return {
    ok: true,
    input: {
      p_id: runId,
      p_performed_at: draft.performedAt.toISOString(),
      p_source: draft.source,
      p_distance_m: distanceM,
      p_moving_seconds: movingSeconds,
      p_elapsed_seconds: movingSeconds,
      p_distance_unit: draft.unit,
      p_name: draft.title.trim() || manualRunTitle(draft.source),
      p_note: draft.note.trim() || null,
      p_elevation_gain_m: null,
      p_elevation_loss_m: null,
      p_calories: estimateCalories({ distanceM, movingSeconds, elevationGainM: 0, bodyweightKg: draft.bodyweightKg }),
      p_effort: draft.effort,
      p_splits: [],
      p_polyline: null,
      p_alts: null,
      p_times: null,
      p_best_efforts: {},
      p_map_visibility: draft.mapVisibility,
      p_steps: null,
      p_distances: null,
      p_moving_times: null,
      p_route_id: null,
    },
  };
}
