/**
 * The unified "recent" feed: lifting sessions, activities and rest days in one
 * chronological list, each with a real name rather than a bare date.
 *
 * Pure so the naming and ordering rules are testable.
 */

import { ACTIVITY_LABEL, activityMetrics, type ActivityRecord } from './activities';

export type TimelineKind = 'workout' | 'activity' | 'rest';

export interface TimelineWorkout {
  id: string;
  /** Whatever preset started it; null for an ad-hoc session. */
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  volume: number;
  setCount: number;
}

export interface TimelineRest {
  id: string;
  date: string;
  note: string | null;
}

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  /** What the row is called: preset name, activity name, or "Rest day". */
  title: string;
  /** Second line: metrics for activities, volume/sets for workouts. */
  detail: string;
  /** Local YYYY-MM-DD, for grouping and the date line. */
  date: string;
  /** Sort key — ISO instant. */
  at: string;
  durationSeconds: number;
  /** Present for workouts so the row can navigate to the session. */
  workoutId?: string;
  /** Present for runs with a detail page, so the row can open the run. */
  runId?: string;
}

/** The label for an unnamed lifting session. */
export const DEFAULT_WORKOUT_NAME = 'Workout';

function localDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function workoutTitle(name: string | null | undefined): string {
  const clean = name?.trim();
  return clean && clean.length > 0 ? clean : DEFAULT_WORKOUT_NAME;
}

/**
 * Merge the three sources into one list, newest first.
 *
 * Rest days have no time of day, so they sort to the end of their date — a
 * workout logged on a day you also marked as rest still reads first.
 */
export function buildTimeline(
  workouts: TimelineWorkout[],
  activities: ActivityRecord[],
  restDays: TimelineRest[],
  unit = 'lb',
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const w of workouts) {
    // Only finished sessions belong in a "recent" list.
    if (!w.endedAt) continue;
    const bits: string[] = [];
    if (w.volume > 0) bits.push(`${Math.round(w.volume).toLocaleString('en-US')} ${unit}`);
    if (w.setCount > 0) bits.push(`${w.setCount} set${w.setCount === 1 ? '' : 's'}`);
    entries.push({
      id: `workout-${w.id}`,
      kind: 'workout',
      title: workoutTitle(w.name),
      detail: bits.join(' · '),
      date: localDate(w.startedAt),
      at: w.startedAt,
      durationSeconds: w.durationSeconds,
      workoutId: w.id,
    });
  }

  for (const a of activities) {
    const custom = a.name?.trim();
    entries.push({
      id: `activity-${a.id}`,
      kind: 'activity',
      title: custom && custom.length > 0 ? custom : ACTIVITY_LABEL[a.kind] ?? 'Activity',
      detail: activityMetrics(a),
      date: localDate(a.performedAt),
      at: a.performedAt,
      durationSeconds: a.durationSeconds,
      ...(a.hasRunDetail ? { runId: a.id } : {}),
    });
  }

  for (const r of restDays) {
    entries.push({
      id: `rest-${r.id}`,
      kind: 'rest',
      title: 'Rest day',
      detail: r.note?.trim() || 'Streak kept',
      date: r.date,
      // Start of day so rest sorts below anything actually done that day.
      at: `${r.date}T00:00:00.000Z`,
      durationSeconds: 0,
    });
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Entries that fall on one local date. */
export function entriesOn(entries: TimelineEntry[], date: string): TimelineEntry[] {
  return entries.filter((e) => e.date === date);
}
