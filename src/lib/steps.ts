/**
 * Step counts from the iPhone's motion coprocessor: Core Motion's pedometer,
 * through expo-sensors. This is not HealthKit. The phone counts steps all day
 * on its own and keeps the last seven days, so the app asks for a span of
 * time and gets a number back; nothing runs in the background to do it.
 *
 * Privacy: today's count is only ever shown on screen. The only step count
 * that leaves the phone is a run's total, saved with the run.
 *
 * Every call fails soft: no motion chip, no permission or an error all come
 * back as null, and the screens simply leave steps out.
 */
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

export type StepAccess = 'granted' | 'denied' | 'undetermined' | 'unavailable';

async function available(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getStepAccess(): Promise<StepAccess> {
  if (!(await available())) return 'unavailable';
  try {
    return (await Pedometer.getPermissionsAsync()).status;
  } catch {
    return 'unavailable';
  }
}

/** Shows the Motion & Fitness prompt if it hasn't been answered yet. */
export async function requestStepAccess(): Promise<StepAccess> {
  if (!(await available())) return 'unavailable';
  try {
    return (await Pedometer.requestPermissionsAsync()).status;
  } catch {
    return 'unavailable';
  }
}

/**
 * Steps taken across the given spans of time ([start, end] in epoch
 * milliseconds), or null when the phone can't say.
 */
export async function stepsDuring(spans: readonly [number, number][]): Promise<number | null> {
  if (spans.length === 0) return 0;
  try {
    let total = 0;
    for (const [start, end] of spans) {
      if (end <= start) continue;
      const { steps } = await Pedometer.getStepCountAsync(new Date(start), new Date(end));
      total += steps;
    }
    return total;
  } catch {
    return null;
  }
}

/** Like stepsDuring, but gives up after `ms` so a slow answer never holds up a save. */
export function stepsDuringWithin(spans: readonly [number, number][], ms: number): Promise<number | null> {
  return Promise.race([
    stepsDuring(spans),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
