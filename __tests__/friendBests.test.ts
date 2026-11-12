import { friendBests } from '../src/domain/friendBests';

const row = (
  exercise_name: string,
  best_weight: number | null,
  best_reps: number,
  best_e1rm: number | null,
  bodyweight?: boolean,
) => ({ exercise_name, best_weight, best_reps, best_e1rm, bodyweight });

describe('friendBests', () => {
  it('keeps a weighted lift’s numbers', () => {
    const b = friendBests([row('Barbell Bench Press', 100, 5, 116.7, false)]);
    expect(b.bestWeight).toEqual({ 'barbell bench press': 100 });
    expect(b.bestE1rm).toEqual({ 'barbell bench press': 116.7 });
    expect(b.bodyweight).toEqual([]);
  });

  it('marks a bodyweight exercise BW and keeps only its reps', () => {
    const b = friendBests([row('Pull-Up', null, 12, null, true)]);
    expect(b.bodyweight).toEqual(['pull-up']);
    expect(b.bestReps).toEqual({ 'pull-up': 12 });
    expect(b.bestWeight).toEqual({});
    expect(b.bestE1rm).toEqual({});
  });

  it('never keeps a number for a BW exercise, even if one arrives', () => {
    const b = friendBests([row('Dip', 92.5, 8, 111, true)]);
    expect(b.bestWeight).toEqual({});
    expect(b.bestE1rm).toEqual({});
  });

  it('reads rows from before migration 0037 as they were', () => {
    const b = friendBests([row('Pull-Up', 92.5, 6, 111)]);
    expect(b.bestWeight).toEqual({ 'pull-up': 92.5 });
    expect(b.bodyweight).toEqual([]);
  });

  it('gives no number for a name shared with a BW exercise', () => {
    const b = friendBests([row('Ring Row', 40, 10, 53, false), row('ring row', null, 12, null, true)]);
    expect(b.bestWeight).toEqual({});
    expect(b.bestReps).toEqual({ 'ring row': 12 });
    expect(b.bodyweight).toEqual(['ring row']);
  });

  it('takes the best of exercises with the same name', () => {
    const b = friendBests([row('Squat', 140, 3, 154, false), row('squat', 150, 2, 160, false)]);
    expect(b.bestWeight).toEqual({ squat: 150 });
    expect(b.bestE1rm).toEqual({ squat: 160 });
  });

  it('skips a row with no name', () => {
    expect(friendBests([row('', 50, 5, 58, false)]).bestWeight).toEqual({});
  });
});
