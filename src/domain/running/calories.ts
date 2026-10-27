/**
 * Calorie estimate for a run or walk. Pure, no I/O.
 *
 * Uses the American College of Sports Medicine metabolic equations, which
 * estimate oxygen use from speed and grade:
 *   running: VO2 = 0.2 x speed + 0.9 x speed x grade + 3.5  (ml/kg/min)
 *   walking: VO2 = 0.1 x speed + 1.8 x speed x grade + 3.5
 * with speed in metres per minute, and about 5 kcal per litre of oxygen.
 *
 * Grade is the climb spread over the whole distance, which is how much uphill
 * work the run held on average; downhill is not credited. The result is gross
 * calories, including what the body burns at rest over that time.
 *
 * It is an estimate, and the app says so. Without a bodyweight there is no
 * honest number, so the result is null and the screen asks for one.
 */

/** At or above this speed the running equation applies; below it, walking. */
export const RUN_SPEED_MPS = 2.0;
const KCAL_PER_LITRE_O2 = 5;
/** Steeper average grades than this are almost always altitude noise. */
const MAX_GRADE = 0.15;

export interface CalorieInput {
  distanceM: number;
  movingSeconds: number;
  elevationGainM: number;
  /** Bodyweight in kilograms, or null when the user has not set one. */
  bodyweightKg: number | null;
}

export function estimateCalories(input: CalorieInput): number | null {
  const { distanceM, movingSeconds, elevationGainM, bodyweightKg } = input;
  if (bodyweightKg == null || !(bodyweightKg >= 20 && bodyweightKg <= 400)) return null;
  if (!(movingSeconds > 0) || !(distanceM > 0)) return null;

  const mps = distanceM / movingSeconds;
  const speed = mps * 60;
  const grade = Math.min(MAX_GRADE, Math.max(0, (elevationGainM || 0) / distanceM));
  const vo2 =
    mps >= RUN_SPEED_MPS
      ? 0.2 * speed + 0.9 * speed * grade + 3.5
      : 0.1 * speed + 1.8 * speed * grade + 3.5;
  const kcalPerMinute = (vo2 * bodyweightKg * KCAL_PER_LITRE_O2) / 1000;
  return Math.round(kcalPerMinute * (movingSeconds / 60));
}
