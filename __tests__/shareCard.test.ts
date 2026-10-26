import {
  SHARE_TRIM_END_M,
  buildRunCard,
  buildWorkoutCard,
  sharedOutline,
  splitBars,
  volumeComparison,
  workoutTitle,
  type RunCardInput,
} from '../src/domain/shareCard';
import { haversine, offset, type LatLon } from '../src/domain/running/geo';
import { buildSummary, type SummaryExerciseRow } from '../src/domain/workoutSummary';

describe('volumeComparison', () => {
  it('compares with the biggest thing the volume reaches', () => {
    expect(volumeComparison(500, 'lb')).toBeNull();
    expect(volumeComparison(1_000, 'lb')).toBe("That's about a horse");
    expect(volumeComparison(2_000, 'lb')).toBe("That's about 2 horses");
    expect(volumeComparison(2_900, 'lb')).toBe("That's about a small car");
    expect(volumeComparison(12_450, 'lb')).toBe("That's about 2.5 pickup trucks");
    expect(volumeComparison(900_000, 'lb')).toBe("That's about 11 loaded semi trucks");
  });

  it('converts kilograms first', () => {
    // 5,000 kg is about 11,000 lb: two pickups and a bit.
    expect(volumeComparison(5_000, 'kg')).toBe("That's about 2.2 pickup trucks");
  });
});

describe('workoutTitle', () => {
  it("uses the workout's own name", () => {
    expect(workoutTitle('  Push Day 1 ', { chest: 9 })).toBe('Push Day 1');
  });

  it('names an unnamed workout from what was trained', () => {
    expect(workoutTitle(null, {})).toBe('Workout');
    expect(workoutTitle(null, { back: 6 })).toBe('Back Day');
    expect(workoutTitle(null, { triceps: 4, chest: 9 })).toBe('Chest & Triceps');
    expect(workoutTitle('', { chest: 1, back: 1, quads: 1, shoulders: 1, core: 1 })).toBe('Full Body');
  });
});

function row(over: Partial<SummaryExerciseRow> & { exerciseId: string }): SummaryExerciseRow {
  return {
    exerciseName: over.exerciseId,
    workingSets: 3,
    volume: 3000,
    bestWeight: 200,
    bestReps: 5,
    bestE1rm: 233,
    prevBestWeight: 190,
    prevBestE1rm: 230,
    isWeightPr: false,
    isE1rmPr: false,
    ...over,
  };
}

describe('buildWorkoutCard', () => {
  const rows = [
    row({ exerciseId: 'Bench Press', isWeightPr: true, bestWeight: 225, prevBestWeight: 215 }),
    row({ exerciseId: 'Squat', isWeightPr: true, prevBestWeight: null }),
    row({ exerciseId: 'Plank', bestWeight: 0, bestReps: 1, volume: 0 }),
    row({ exerciseId: 'Push-Up', bestWeight: 0, bestReps: 20, volume: 0 }),
    row({ exerciseId: 'Row' }),
    row({ exerciseId: 'Curl' }),
    row({ exerciseId: 'Dip' }),
  ];
  const summary = buildSummary(3_900, { totalVolume: 18_250.4, totalReps: 140, totalSets: 21 }, rows);
  const card = buildWorkoutCard({
    name: null,
    dateLabel: 'Sat, Oct 25',
    summary,
    unit: 'lb',
    setsByGroup: { chest: 9, quads: 4, core: 3 },
    holds: { Plank: 90 },
    maxRecords: 1,
    maxExercises: 5,
  });

  it('leads with the volume and an everyday comparison', () => {
    expect(card.volume).toBe('18,250');
    expect(card.volumeLabel).toBe('lb lifted');
    expect(card.comparison).toBe("That's about 1.4 African elephants");
    expect(card.subtitle).toBe('Sat, Oct 25 · 1h 5m');
    expect(card.stats.map((s) => s.value)).toEqual(['21', '140', '7']);
  });

  it('lists records, then counts the ones that did not fit', () => {
    expect(card.records).toHaveLength(1);
    expect(card.moreRecords).toBe(1);
    // A first-ever lift leads the records.
    expect(card.records[0]).toEqual({ name: 'Squat', value: '200 lb', detail: 'Heaviest set, first time' });
  });

  it('shows each exercise its own way, and marks records', () => {
    expect(card.exercises).toHaveLength(5);
    expect(card.moreExercises).toBe(2);
    expect(card.exercises[0]).toEqual({ name: 'Bench Press', detail: '3 sets · 225 × 5', isRecord: true });
    expect(card.exercises[2].detail).toBe('3 sets · 1:30 hold');
    expect(card.exercises[3].detail).toBe('3 sets · 20 reps');
  });

  it('names the most-worked muscles', () => {
    expect(card.title).toBe('Chest & Quads');
    expect(card.muscleLine).toBe('Chest · Quads · Core');
  });
});

/** A straight route north, one point every 25 m. */
function straightRoute(metres: number, from: LatLon = { lat: 47.6, lon: -122.3 }): LatLon[] {
  return Array.from({ length: Math.floor(metres / 25) + 1 }, (_, i) => offset(from, i * 25, 0));
}

describe('sharedOutline', () => {
  it('hides the first and last 200 m', () => {
    const route = straightRoute(2_000);
    const shown = sharedOutline(route, []);
    expect(haversine(route[0], shown[0])).toBeGreaterThanOrEqual(SHARE_TRIM_END_M - 1);
    expect(haversine(route[route.length - 1], shown[shown.length - 1])).toBeGreaterThanOrEqual(SHARE_TRIM_END_M - 1);
    expect(shown.length).toBeLessThan(route.length);
  });

  it('also hides the ends inside a privacy zone, with a margin', () => {
    const route = straightRoute(3_000);
    const home = { ...route[0], radiusM: 500 };
    const shown = sharedOutline(route, [home]);
    expect(haversine(home, shown[0])).toBeGreaterThan(500 + 10 - 25);
    expect(shown.every((p) => haversine(home, p) > home.radiusM)).toBe(true);
  });

  it('shows nothing when the whole run is near home or too short', () => {
    expect(sharedOutline(straightRoute(350), [])).toEqual([]);
    const route = straightRoute(1_500);
    expect(sharedOutline(route, [{ ...route[30], radiusM: 1_000 }])).toEqual([]);
    expect(sharedOutline([], [])).toEqual([]);
  });
});

describe('splitBars', () => {
  const split = (seconds: number, distanceM = 1609.344) => ({ seconds, distanceM, elevationChangeM: null });

  it('makes the fastest full split the tallest, and drops a partial one', () => {
    const bars = splitBars([split(540), split(480), split(510), split(200, 600)], 'mi');
    expect(bars).toHaveLength(3);
    expect(bars[1]).toEqual({ height: 1, fastest: true });
    expect(bars[0].height).toBeCloseTo(0.3, 5);
    expect(bars[2].height).toBeGreaterThan(0.3);
    expect(bars[2].height).toBeLessThan(1);
  });

  it('needs at least two full splits to compare', () => {
    expect(splitBars([split(500)], 'mi')).toEqual([]);
  });
});

describe('buildRunCard', () => {
  const route = straightRoute(5_000);
  const base: RunCardInput = {
    name: 'Morning Run',
    dateLabel: 'Sun, Oct 26',
    unit: 'km',
    distanceM: 5_000,
    movingSeconds: 25 * 60,
    elevationGainM: null,
    splits: [],
    bestEfforts: { mile: 460, '5k': 1_500 },
    recordEfforts: ['mile'],
    longest: false,
    route,
    zones: [],
    showRoute: true,
  };

  it('leads with the distance, then pace and time', () => {
    const card = buildRunCard(base);
    expect(card.distance).toBe('5.00');
    expect(card.distanceUnit).toBe('kilometres');
    expect(card.stats).toEqual([
      { value: '5:00', label: 'pace /km' },
      { value: '25:00', label: 'time' },
    ]);
  });

  it('adds the climb only when there was one', () => {
    expect(buildRunCard({ ...base, elevationGainM: 42 }).stats[2]).toEqual({ value: '42 m', label: 'climb' });
  });

  it('puts records first among the highlights', () => {
    const card = buildRunCard(base);
    expect(card.highlights.map((h) => [h.label, h.isRecord])).toEqual([
      ['Mile', true],
      ['5K', false],
    ]);
  });

  it('draws the trimmed outline only when the route is shown', () => {
    expect(buildRunCard(base).outline.length).toBeGreaterThan(1);
    expect(buildRunCard({ ...base, showRoute: false }).outline).toEqual([]);
  });
});
