/**
 * Body chart — maps the muscle groups the app tracks onto the regions drawn on
 * the front/back figures, and grades each by how much work it got this week.
 *
 * Pure so the grading rules are testable; the drawing lives in the component.
 */

import { MUSCLE_GROUPS, type MuscleGroup } from './stats';

/** How hard a region has been hit this week. */
export type CoverageLevel = 'none' | 'light' | 'solid' | 'heavy';

/**
 * Set counts per muscle group per week. These are deliberately gentle — the
 * chart is a "did you miss anything" glance, not a prescription.
 */
export const COVERAGE_THRESHOLDS = { light: 1, solid: 4, heavy: 9 } as const;

export function coverageLevel(sets: number): CoverageLevel {
  if (!Number.isFinite(sets) || sets < COVERAGE_THRESHOLDS.light) return 'none';
  if (sets >= COVERAGE_THRESHOLDS.heavy) return 'heavy';
  if (sets >= COVERAGE_THRESHOLDS.solid) return 'solid';
  return 'light';
}

/** Which side of the body each group is drawn on. */
export const GROUP_SIDE: Record<MuscleGroup, 'front' | 'back'> = {
  chest: 'front',
  shoulders: 'front',
  biceps: 'front',
  quads: 'front',
  core: 'front',
  back: 'back',
  triceps: 'back',
  hamstrings: 'back',
  glutes: 'back',
  calves: 'back',
};

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

export interface RegionState {
  group: MuscleGroup;
  label: string;
  side: 'front' | 'back';
  sets: number;
  level: CoverageLevel;
}

/** Grade every tracked muscle group from this week's set counts. */
export function buildBodyChart(
  weekCoverage: Partial<Record<MuscleGroup, number>>,
): RegionState[] {
  return MUSCLE_GROUPS.map((group) => {
    const sets = Math.max(0, weekCoverage[group] ?? 0);
    return {
      group,
      label: GROUP_LABEL[group],
      side: GROUP_SIDE[group],
      sets,
      level: coverageLevel(sets),
    };
  });
}

/** Groups with nothing logged this week — the "still to hit" list. */
export function missedGroups(regions: RegionState[]): MuscleGroup[] {
  return regions.filter((r) => r.level === 'none').map((r) => r.group);
}

export interface ChartSummary {
  trained: number;
  total: number;
  /** 0..1 share of groups with at least one set. */
  fraction: number;
  headline: string;
}

export function chartSummary(regions: RegionState[]): ChartSummary {
  const total = regions.length;
  const trained = regions.filter((r) => r.level !== 'none').length;
  const fraction = total === 0 ? 0 : trained / total;

  let headline: string;
  if (trained === 0) headline = 'Nothing logged this week yet';
  else if (trained === total) headline = 'Full body covered this week';
  else {
    const missed = missedGroups(regions);
    const names = missed.slice(0, 3).map((g) => GROUP_LABEL[g].toLowerCase());
    const extra = missed.length > 3 ? ` +${missed.length - 3} more` : '';
    headline = `Still to hit: ${names.join(', ')}${extra}`;
  }

  return { trained, total, fraction, headline };
}

// --- Fitting the chart to the screen ----------------------------------------
// On Today the chart takes whatever height is left under the buttons, so the
// screen doesn't scroll. These size the two figures to that space.

/** Each figure is drawn on a 100 × 212 canvas. */
export const FIGURE_ASPECT = 212 / 100;
/** The figure width outside Today, and the most a fitted figure may grow to. */
export const FIGURE_WIDTH = 98;
export const FIGURE_MAX_WIDTH = 120;
/** Below this the muscle shapes get too small to tell apart. */
export const FIGURE_MIN_WIDTH = 60;
/** The FRONT / BACK label under each figure, with its gap. */
export const FIGURE_LABEL_HEIGHT = 14;
/** The legend column beside the figures needs this much width. */
export const LEGEND_MIN_WIDTH = 104;
/** The gap between the two figures and the legend. */
export const FIGURE_GAP = 8;

/**
 * The widest the figures can be drawn in a space this size: as tall as the
 * space allows, but leaving the legend its column, and kept between the
 * minimum and maximum widths.
 */
export function fittedFigureWidth(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return FIGURE_WIDTH;
  const byHeight = (height - FIGURE_LABEL_HEIGHT) / FIGURE_ASPECT;
  const byWidth = (width - LEGEND_MIN_WIDTH - 2 * FIGURE_GAP) / 2;
  const fitted = Math.min(FIGURE_MAX_WIDTH, byHeight, byWidth);
  return Math.floor(Math.max(FIGURE_MIN_WIDTH, fitted));
}
