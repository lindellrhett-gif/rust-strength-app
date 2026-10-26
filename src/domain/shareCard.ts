/**
 * What goes on the image cards shared after a workout or a run. Pure, no I/O:
 * the drawing is in src/components/share/ and the screens that capture and
 * share the image are in app/share/.
 *
 * A card can end up anywhere (an Instagram story, a group chat), so it only
 * ever shows what the person chose to share, and a run's outline is trimmed
 * the same way friends' maps are before it is drawn.
 */

import { GROUP_LABEL } from './bodyChart';
import { formatClock, formatDurationShort } from './duration';
import { formatHold } from './loadType';
import { EFFORT_KEYS, EFFORT_LABEL, type BestEfforts, type EffortKey } from './running/bestEfforts';
import type { RunSplit } from './running/detail';
import { haversine, type LatLon } from './running/geo';
import { formatElevation, formatPaceValue, METERS_PER, paceSeconds, toUnit, type RunDistanceUnit } from './running/units';
import type { MuscleGroup } from './stats';
import type { WorkoutSummary } from './workoutSummary';

/** Pixel size the cards are exported at: an Instagram story, 9:16. */
export const CARD_EXPORT = { width: 1080, height: 1920 } as const;
/** Layout size in points; exported at three times this. */
export const CARD_SIZE = { width: 360, height: 640 } as const;

export interface CardStat {
  value: string;
  label: string;
}

// --- Workout ---------------------------------------------------------------

/**
 * Everyday things to compare a session's volume with, in pounds. Generic on
 * purpose: the card is shared publicly, so it names no brands.
 */
export const VOLUME_OBJECTS = [
  { lb: 1_000, one: 'a horse', many: 'horses' },
  { lb: 2_900, one: 'a small car', many: 'small cars' },
  { lb: 5_000, one: 'a pickup truck', many: 'pickup trucks' },
  { lb: 13_000, one: 'an African elephant', many: 'African elephants' },
  { lb: 25_000, one: 'a loaded school bus', many: 'loaded school buses' },
  { lb: 80_000, one: 'a loaded semi truck', many: 'loaded semi trucks' },
] as const;

const LB_PER_KG = 2.20462;

/**
 * "That's about 4.2 small cars", against the biggest thing the volume
 * reaches. Null below the smallest, where a comparison would be a stretch.
 */
export function volumeComparison(volume: number, unit: 'lb' | 'kg'): string | null {
  const lb = unit === 'kg' ? volume * LB_PER_KG : volume;
  if (!(lb >= VOLUME_OBJECTS[0].lb)) return null;
  const thing = [...VOLUME_OBJECTS].reverse().find((o) => lb >= o.lb)!;
  const count = lb / thing.lb;
  if (count < 1.15) return `That's about ${thing.one}`;
  const shown = count < 10 ? count.toFixed(1).replace(/\.0$/, '') : Math.round(count).toLocaleString('en-US');
  return `That's about ${shown} ${thing.many}`;
}

export interface CardRecord {
  name: string;
  value: string;
  /** "Heaviest set, +10 lb", "Best estimated 1RM, first time". */
  detail: string;
}

export interface CardExercise {
  name: string;
  /** "4 sets · 225 × 5". */
  detail: string;
  isRecord: boolean;
}

export interface WorkoutCard {
  title: string;
  subtitle: string;
  volume: string;
  volumeLabel: string;
  comparison: string | null;
  stats: CardStat[];
  records: CardRecord[];
  moreRecords: number;
  exercises: CardExercise[];
  moreExercises: number;
  /** Working sets per muscle group, for the body figure. */
  muscles: Partial<Record<MuscleGroup, number>>;
  /** The most-worked groups: "Chest · Triceps · Shoulders". */
  muscleLine: string;
}

export interface WorkoutCardInput {
  name: string | null;
  /** Formatted by the caller, in the phone's locale: "Sat, Oct 25". */
  dateLabel: string;
  summary: WorkoutSummary;
  unit: 'lb' | 'kg';
  /** Working sets per muscle group this session. */
  setsByGroup: Partial<Record<MuscleGroup, number>>;
  /** Longest hold per exercise id, for timed exercises. */
  holds: Record<string, number>;
  /** How many records and exercises fit; the rest are counted. */
  maxRecords?: number;
  maxExercises?: number;
}

/** Groups by sets, most first, ties in the app's usual order. */
function rankedGroups(setsByGroup: Partial<Record<MuscleGroup, number>>): MuscleGroup[] {
  return (Object.keys(setsByGroup) as MuscleGroup[])
    .filter((g) => (setsByGroup[g] ?? 0) > 0)
    .sort((a, b) => (setsByGroup[b] ?? 0) - (setsByGroup[a] ?? 0));
}

/** The workout's name, or one from what was trained: "Chest & Triceps". */
export function workoutTitle(name: string | null, setsByGroup: Partial<Record<MuscleGroup, number>>): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const groups = rankedGroups(setsByGroup);
  if (groups.length >= 5) return 'Full Body';
  if (groups.length === 0) return 'Workout';
  if (groups.length === 1) return `${GROUP_LABEL[groups[0]]} Day`;
  return `${GROUP_LABEL[groups[0]]} & ${GROUP_LABEL[groups[1]]}`;
}

function trim1(n: number): string {
  return Number(n.toFixed(1)).toString();
}

export function buildWorkoutCard(input: WorkoutCardInput): WorkoutCard {
  const { summary, unit } = input;
  const maxRecords = input.maxRecords ?? 3;
  const maxExercises = input.maxExercises ?? 5;
  const recordIds = new Set(summary.records.map((r) => r.exerciseId));

  const records = summary.records.map<CardRecord>((r) => ({
    name: r.exerciseName,
    value: `${trim1(r.value)} ${unit}`,
    detail: `${r.kind === 'weight' ? 'Heaviest set' : 'Best estimated 1RM'}${
      r.previous == null ? ', first time' : `, +${trim1(r.delta ?? 0)} ${unit}`
    }`,
  }));

  const exercises = summary.exercises.map<CardExercise>((e) => {
    const hold = input.holds[e.exerciseId];
    const top =
      hold != null
        ? `${formatHold(hold)} hold`
        : e.bestWeight > 0
          ? `${trim1(e.bestWeight)} × ${e.bestReps}`
          : `${e.bestReps} reps`;
    return {
      name: e.exerciseName,
      detail: `${e.workingSets} set${e.workingSets === 1 ? '' : 's'} · ${top}`,
      isRecord: recordIds.has(e.exerciseId),
    };
  });

  const groups = rankedGroups(input.setsByGroup);

  return {
    title: workoutTitle(input.name, input.setsByGroup),
    subtitle: `${input.dateLabel} · ${formatDurationShort(summary.durationSeconds)}`,
    volume: Math.round(summary.totalVolume).toLocaleString('en-US'),
    volumeLabel: `${unit} lifted`,
    comparison: volumeComparison(summary.totalVolume, unit),
    stats: [
      { value: String(summary.totalSets), label: summary.totalSets === 1 ? 'set' : 'sets' },
      { value: summary.totalReps.toLocaleString('en-US'), label: summary.totalReps === 1 ? 'rep' : 'reps' },
      { value: String(summary.exerciseCount), label: summary.exerciseCount === 1 ? 'exercise' : 'exercises' },
    ],
    records: records.slice(0, maxRecords),
    moreRecords: Math.max(0, records.length - maxRecords),
    exercises: exercises.slice(0, maxExercises),
    moreExercises: Math.max(0, exercises.length - maxExercises),
    muscles: input.setsByGroup,
    muscleLine: groups
      .slice(0, 3)
      .map((g) => GROUP_LABEL[g])
      .join(' · '),
  };
}

// --- Run -------------------------------------------------------------------

/** The start and end of a shared route are hidden by at least this much, as on friends' maps. */
export const SHARE_TRIM_END_M = 200;
/** A little more than a privacy zone's radius, so nothing on its edge slips through. */
export const ZONE_MARGIN_M = 10;

export interface ZoneLike extends LatLon {
  radiusM: number;
}

/**
 * The part of a route that can be shown: the first and last 200 m dropped,
 * and any stretch at either end inside a privacy zone, the same rule the
 * server applies to friends' maps (migration 0021). Empty when nothing is
 * left to draw.
 */
export function sharedOutline(
  route: readonly LatLon[],
  zones: readonly ZoneLike[],
  endM = SHARE_TRIM_END_M,
): LatLon[] {
  if (route.length < 2) return [];
  const along: number[] = [0];
  for (let i = 1; i < route.length; i += 1) along.push(along[i - 1] + haversine(route[i - 1], route[i]));
  const total = along[along.length - 1];
  const hidden = (i: number) =>
    along[i] < endM ||
    total - along[i] < endM ||
    zones.some((z) => haversine(z, route[i]) <= z.radiusM + ZONE_MARGIN_M);

  let lo = 0;
  while (lo < route.length && hidden(lo)) lo += 1;
  let hi = route.length - 1;
  while (hi > lo && hidden(hi)) hi -= 1;
  if (hi - lo < 1) return [];
  return route.slice(lo, hi + 1).map((p) => ({ lat: p.lat, lon: p.lon }));
}

export interface SplitBar {
  /** 0.3 to 1: the fastest split is full height. */
  height: number;
  fastest: boolean;
}

/**
 * One bar per full mile or kilometre, taller for faster. A partial last split
 * is left out: its pace isn't comparable.
 */
export function splitBars(splits: readonly RunSplit[], unit: RunDistanceUnit): SplitBar[] {
  const full = splits.filter((s) => s.distanceM >= METERS_PER[unit] * 0.99 && s.seconds > 0);
  if (full.length < 2) return [];
  const speeds = full.map((s) => s.distanceM / s.seconds);
  const min = Math.min(...speeds);
  const max = Math.max(...speeds);
  const fastest = speeds.indexOf(max);
  return speeds.map((v, i) => ({
    height: max - min < 1e-9 ? 1 : 0.3 + (0.7 * (v - min)) / (max - min),
    fastest: i === fastest,
  }));
}

export interface RunCardInput {
  name: string;
  dateLabel: string;
  unit: RunDistanceUnit;
  distanceM: number;
  movingSeconds: number;
  elevationGainM: number | null;
  splits: readonly RunSplit[];
  bestEfforts: BestEfforts;
  /** Efforts in this run that are the person's fastest ever. */
  recordEfforts: readonly EffortKey[];
  /** Whether this is the person's longest run. */
  longest: boolean;
  route: readonly LatLon[];
  zones: readonly ZoneLike[];
  showRoute: boolean;
}

export interface RunHighlight {
  label: string;
  value: string;
  isRecord: boolean;
}

export interface RunCard {
  title: string;
  subtitle: string;
  distance: string;
  distanceUnit: string;
  stats: CardStat[];
  bars: SplitBar[];
  highlights: RunHighlight[];
  /** True when this was the longest run yet. */
  longest: boolean;
  /** Trimmed outline to draw, or empty. */
  outline: LatLon[];
}

export function buildRunCard(input: RunCardInput): RunCard {
  const { unit } = input;
  const pace = paceSeconds(input.distanceM, input.movingSeconds, unit);
  const stats: CardStat[] = [
    { value: formatPaceValue(pace), label: `pace /${unit}` },
    { value: formatClock(input.movingSeconds), label: 'time' },
  ];
  if (input.elevationGainM != null && input.elevationGainM > 0) {
    stats.push({ value: formatElevation(input.elevationGainM, unit), label: 'climb' });
  }

  const records = new Set(input.recordEfforts);
  // Records first, then the longest distances: a 10K PR says more than a mile split.
  const highlights = EFFORT_KEYS.filter((k) => input.bestEfforts[k] != null)
    .map<RunHighlight>((k) => ({
      label: EFFORT_LABEL[k],
      value: formatClock(input.bestEfforts[k]!),
      isRecord: records.has(k),
    }))
    .reverse()
    .sort((a, b) => Number(b.isRecord) - Number(a.isRecord))
    .slice(0, 3);

  return {
    title: input.name,
    subtitle: input.dateLabel,
    distance: toUnit(Math.max(0, input.distanceM), unit).toFixed(2),
    distanceUnit: unit === 'mi' ? 'miles' : 'kilometres',
    stats,
    bars: splitBars(input.splits, unit),
    highlights,
    longest: input.longest,
    outline: input.showRoute ? sharedOutline(input.route, input.zones) : [],
  };
}
