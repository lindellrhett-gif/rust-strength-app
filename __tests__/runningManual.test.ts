import { buildManualRunInput, type ManualRunDraft } from '../src/domain/running/manual';

const NOW = Date.UTC(2026, 9, 7, 18);
const draft = (overrides: Partial<ManualRunDraft> = {}): ManualRunDraft => ({
  source: 'treadmill',
  distance: 3.1,
  unit: 'mi',
  movingSeconds: 1680,
  performedAt: new Date(NOW - 3_600_000),
  title: '',
  note: '',
  effort: 5,
  bodyweightKg: 80,
  mapVisibility: 'private',
  ...overrides,
});

describe('a run entered by hand', () => {
  it('saves like any run, with no route', () => {
    const result = buildManualRunInput(draft(), 'run-1', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      p_id: 'run-1',
      p_source: 'treadmill',
      p_distance_m: 4989,
      p_moving_seconds: 1680,
      p_elapsed_seconds: 1680,
      p_distance_unit: 'mi',
      p_name: 'Treadmill run',
      p_effort: 5,
      p_polyline: null,
      p_times: null,
      p_distances: null,
      p_splits: [],
      p_best_efforts: {},
    });
    expect(result.input.p_calories).toBeGreaterThan(300);
  });

  it('keeps a typed title and notes, trimmed', () => {
    const result = buildManualRunInput(draft({ source: 'manual', title: ' Track 800s ', note: ' windy ' }), 'r', NOW);
    expect(result.ok && [result.input.p_name, result.input.p_note]).toEqual(['Track 800s', 'windy']);
  });

  it('reads kilometres too', () => {
    const result = buildManualRunInput(draft({ distance: 5, unit: 'km' }), 'r', NOW);
    expect(result.ok && result.input.p_distance_m).toBe(5000);
  });

  it('leaves calories out without a bodyweight', () => {
    const result = buildManualRunInput(draft({ bodyweightKg: null }), 'r', NOW);
    expect(result.ok && result.input.p_calories).toBeNull();
  });

  it('refuses a run with no distance, no time, an impossible pace or a future start', () => {
    expect(buildManualRunInput(draft({ distance: 0 }), 'r', NOW)).toEqual({ ok: false, error: 'Add how far you ran.' });
    expect(buildManualRunInput(draft({ movingSeconds: 0 }), 'r', NOW).ok).toBe(false);
    expect(buildManualRunInput(draft({ distance: 26.2, movingSeconds: 1200 }), 'r', NOW).ok).toBe(false);
    expect(buildManualRunInput(draft({ performedAt: new Date(NOW + 3_600_000) }), 'r', NOW)).toEqual({
      ok: false,
      error: 'That start time is in the future.',
    });
  });
});
