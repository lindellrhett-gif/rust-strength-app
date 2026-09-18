import {
  LOAD_TYPES,
  LOAD_TYPE_HINT,
  LOAD_TYPE_LABEL,
  asLoadType,
  assistProblem,
  assistedLoad,
  bodyweightLoad,
  exerciseSublabel,
  formatSetLoad,
} from '../src/domain/loadType';

describe('asLoadType', () => {
  it('passes through known types and defaults everything else to weighted', () => {
    for (const t of LOAD_TYPES) expect(asLoadType(t)).toBe(t);
    expect(asLoadType(null)).toBe('weighted');
    expect(asLoadType(undefined)).toBe('weighted');
    expect(asLoadType('banded')).toBe('weighted');
  });

  it('labels and explains every type', () => {
    for (const t of LOAD_TYPES) {
      expect(LOAD_TYPE_LABEL[t].length).toBeGreaterThan(0);
      expect(LOAD_TYPE_HINT[t].length).toBeGreaterThan(0);
    }
  });
});

describe('assistedLoad', () => {
  it('subtracts assistance from bodyweight', () => {
    expect(assistedLoad(180, 40)).toBe(140);
    expect(assistedLoad(82.5, 22.5)).toBe(60);
  });

  it('never goes below zero', () => {
    expect(assistedLoad(180, 200)).toBe(0);
  });

  it('treats negative or nonsense assistance safely', () => {
    expect(assistedLoad(180, -20)).toBe(180);
    expect(assistedLoad(Number.NaN, 20)).toBe(0);
  });
});

describe('bodyweightLoad', () => {
  it('adds any extra weight to bodyweight', () => {
    expect(bodyweightLoad(180, 0)).toBe(180);
    expect(bodyweightLoad(180, 25)).toBe(205);
  });

  it('counts only the added weight when bodyweight is unknown', () => {
    expect(bodyweightLoad(null, 0)).toBe(0);
    expect(bodyweightLoad(null, 25)).toBe(25);
  });

  it('ignores negative added weight', () => {
    expect(bodyweightLoad(180, -10)).toBe(180);
  });
});

describe('assistProblem', () => {
  it('requires a bodyweight', () => {
    expect(assistProblem(null, 40)).toMatch(/bodyweight/);
    expect(assistProblem(0, 40)).toMatch(/bodyweight/);
  });

  it('refuses assistance at or above bodyweight', () => {
    expect(assistProblem(180, 180)).toMatch(/less than/);
    expect(assistProblem(180, 250)).toMatch(/less than/);
  });

  it('accepts a normal set, including no assistance at all', () => {
    expect(assistProblem(180, 40)).toBeNull();
    expect(assistProblem(180, 0)).toBeNull();
  });
});

describe('formatSetLoad', () => {
  const base = { weight: 140, isBodyweight: true, assistWeight: null, addedWeight: null };

  it('shows assisted sets by their assistance', () => {
    expect(formatSetLoad({ ...base, assistWeight: 40 }, 'lb')).toBe('40 lb assist');
    expect(formatSetLoad({ ...base, assistWeight: 0 }, 'lb')).toBe('No assist');
  });

  it('shows bodyweight sets as BW, plus anything added', () => {
    expect(formatSetLoad({ ...base, weight: 180, addedWeight: 0 }, 'lb')).toBe('BW');
    expect(formatSetLoad({ ...base, weight: 205, addedWeight: 25 }, 'kg')).toBe('BW + 25 kg');
  });

  it('keeps older sets logged with the BW button', () => {
    expect(formatSetLoad({ ...base, weight: 180 }, 'lb')).toBe('BW');
  });

  it('shows weighted sets as the number', () => {
    expect(formatSetLoad({ ...base, weight: 152.5, isBodyweight: false }, 'lb')).toBe('152.5');
  });
});

describe('exerciseSublabel', () => {
  it('names the type only when it is not ordinary weights', () => {
    expect(exerciseSublabel('chest', 'weighted')).toBe('chest');
    expect(exerciseSublabel('back', 'assisted')).toBe('back · Assisted');
    expect(exerciseSublabel('back', 'bodyweight')).toBe('back · Bodyweight');
  });
});
