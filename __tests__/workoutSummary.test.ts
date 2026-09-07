import {
  extractRecords,
  buildSummary,
  summaryHeadline,
  type SummaryExerciseRow,
} from '@/domain/workoutSummary';

function row(partial: Partial<SummaryExerciseRow> = {}): SummaryExerciseRow {
  return {
    exerciseId: 'e1',
    exerciseName: 'Bench Press',
    workingSets: 3,
    volume: 3000,
    bestWeight: 200,
    bestReps: 8,
    bestE1rm: 250,
    prevBestWeight: 185,
    prevBestE1rm: 235,
    isWeightPr: false,
    isE1rmPr: false,
    ...partial,
  };
}

describe('extractRecords', () => {
  it('reports a weight PR with the margin over the old mark', () => {
    const [pr] = extractRecords([row({ isWeightPr: true })]);
    expect(pr.kind).toBe('weight');
    expect(pr.value).toBe(200);
    expect(pr.previous).toBe(185);
    expect(pr.delta).toBe(15);
  });

  it('treats a first-ever lift as a record with no delta', () => {
    const [pr] = extractRecords([
      row({ isWeightPr: true, prevBestWeight: null, prevBestE1rm: null }),
    ]);
    expect(pr.previous).toBeNull();
    expect(pr.delta).toBeNull();
  });

  it('does not double-report when both weight and e1RM improved', () => {
    const records = extractRecords([row({ isWeightPr: true, isE1rmPr: true })]);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('weight');
  });

  it('falls back to an e1RM record when the weight was not a PR', () => {
    // More reps at a weight already lifted before.
    const [pr] = extractRecords([row({ isWeightPr: false, isE1rmPr: true })]);
    expect(pr.kind).toBe('e1rm');
  });

  it('ignores exercises with no records', () => {
    expect(extractRecords([row()])).toEqual([]);
  });

  it('ignores a "PR" with no weight behind it', () => {
    expect(extractRecords([row({ bestWeight: 0, bestE1rm: 0, isWeightPr: true })])).toEqual(
      [],
    );
  });

  it('puts brand-new lifts first, then the biggest jumps', () => {
    const records = extractRecords([
      row({ exerciseId: 'a', exerciseName: 'Small', isWeightPr: true, bestWeight: 100, prevBestWeight: 95 }),
      row({ exerciseId: 'b', exerciseName: 'Big', isWeightPr: true, bestWeight: 300, prevBestWeight: 250 }),
      row({ exerciseId: 'c', exerciseName: 'New', isWeightPr: true, bestWeight: 50, prevBestWeight: null }),
    ]);
    expect(records.map((r) => r.exerciseName)).toEqual(['New', 'Big', 'Small']);
  });
});

describe('buildSummary', () => {
  it('carries the totals through and counts exercises', () => {
    const s = buildSummary(
      3600,
      { totalVolume: 12345.6, totalReps: 120, totalSets: 15 },
      [row(), row({ exerciseId: 'e2', exerciseName: 'Squat' })],
    );
    expect(s.durationSeconds).toBe(3600);
    expect(s.totalVolume).toBe(12346);
    expect(s.totalReps).toBe(120);
    expect(s.totalSets).toBe(15);
    expect(s.exerciseCount).toBe(2);
    expect(s.empty).toBe(false);
  });

  it('flags a session with no working sets as empty', () => {
    const s = buildSummary(300, { totalVolume: 0, totalReps: 0, totalSets: 0 }, []);
    expect(s.empty).toBe(true);
    expect(s.records).toEqual([]);
  });

  it('never reports a negative duration', () => {
    expect(buildSummary(-50, { totalVolume: 0, totalReps: 0, totalSets: 1 }, []).durationSeconds).toBe(0);
  });
});

describe('summaryHeadline', () => {
  const totals = { totalVolume: 5000, totalReps: 60, totalSets: 8 };

  it('calls out how many records were set', () => {
    expect(
      summaryHeadline(buildSummary(60, totals, [row({ isWeightPr: true })])),
    ).toMatch(/New personal record/);

    expect(
      summaryHeadline(
        buildSummary(60, totals, [
          row({ exerciseId: 'a', isWeightPr: true }),
          row({ exerciseId: 'b', isWeightPr: true }),
        ]),
      ),
    ).toMatch(/Two personal records/);

    expect(
      summaryHeadline(
        buildSummary(60, totals, [
          row({ exerciseId: 'a', isWeightPr: true }),
          row({ exerciseId: 'b', isWeightPr: true }),
          row({ exerciseId: 'c', isWeightPr: true }),
        ]),
      ),
    ).toMatch(/3 personal records/);
  });

  it('notes a big volume day when there were no PRs', () => {
    const s = buildSummary(60, { totalVolume: 20000, totalReps: 200, totalSets: 24 }, [row()]);
    expect(summaryHeadline(s)).toMatch(/Big volume/);
  });

  it('falls back to a plain completion line', () => {
    expect(summaryHeadline(buildSummary(60, totals, [row()]))).toBe('Session complete');
  });

  it('says so when nothing was logged', () => {
    const s = buildSummary(60, { totalVolume: 0, totalReps: 0, totalSets: 0 }, []);
    expect(summaryHeadline(s)).toBe('No sets logged');
  });
});
