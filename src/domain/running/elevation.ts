/**
 * Elevation gain and loss from noisy GPS altitude. Pure, no I/O.
 *
 * Phone altitude wobbles by a few metres from fix to fix even on a flat track.
 * Adding up every wobble would credit a flat 5K with a hill's worth of climb,
 * so altitudes are smoothed first, and a climb only counts once it clears
 * ELEVATION_THRESHOLD_M from the last turning point (hysteresis).
 */

/** Rises or drops smaller than this are noise. */
export const ELEVATION_THRESHOLD_M = 3;
/** Fixes on each side averaged when smoothing altitude. */
export const ELEVATION_SMOOTH_RADIUS = 2;

/** Centred moving average over the known altitudes; unknown ones stay unknown. */
export function smoothAltitudes(alts: readonly (number | null)[]): (number | null)[] {
  return alts.map((a, i) => {
    if (a == null) return null;
    let sum = 0;
    let n = 0;
    for (let k = i - ELEVATION_SMOOTH_RADIUS; k <= i + ELEVATION_SMOOTH_RADIUS; k += 1) {
      const v = alts[k];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        n += 1;
      }
    }
    return n > 0 ? sum / n : a;
  });
}

export interface ElevationTotals {
  gainM: number;
  lossM: number;
  /** False when the run has too few altitudes to say anything. */
  known: boolean;
}

export function elevationTotals(points: readonly { alt: number | null }[]): ElevationTotals {
  const alts = smoothAltitudes(points.map((p) => p.alt)).filter(
    (a): a is number => a != null && Number.isFinite(a),
  );
  if (alts.length < 2) return { gainM: 0, lossM: 0, known: false };

  let gain = 0;
  let loss = 0;
  let ref = alts[0];
  for (const a of alts) {
    if (a >= ref + ELEVATION_THRESHOLD_M) {
      gain += a - ref;
      ref = a;
    } else if (a <= ref - ELEVATION_THRESHOLD_M) {
      loss += ref - a;
      ref = a;
    }
  }
  return { gainM: gain, lossM: loss, known: true };
}

/**
 * Fills gaps in altitude by straight-line interpolation, holding the nearest
 * known value at the ends, so every stored point has one. Returns null when no
 * altitude is known at all.
 */
export function fillAltitudes(alts: readonly (number | null)[]): number[] | null {
  const known = alts
    .map((a, i) => (a != null && Number.isFinite(a) ? i : -1))
    .filter((i) => i >= 0);
  if (known.length === 0) return null;
  return alts.map((a, i) => {
    if (a != null && Number.isFinite(a)) return a;
    const before = [...known].reverse().find((k) => k < i);
    const after = known.find((k) => k > i);
    if (before == null) return alts[after!] as number;
    if (after == null) return alts[before] as number;
    const x = alts[before] as number;
    const y = alts[after] as number;
    return x + ((y - x) * (i - before)) / (after - before);
  });
}
