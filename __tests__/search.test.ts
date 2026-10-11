import { editDistance, normalize, search, searchScore, typoAllowance } from '../src/domain/search';

const exercises = [
  { label: 'Barbell Bench Press', sublabel: 'chest' },
  { label: 'Dumbbell Bench Press', sublabel: 'chest' },
  { label: 'Dumbbell Curl', sublabel: 'biceps' },
  { label: 'Lat Pulldown', sublabel: 'back' },
  { label: 'Pull-Up', sublabel: 'back · Bodyweight' },
  { label: 'Romanian Deadlift', sublabel: 'hamstrings' },
  { label: 'Seated Cable Row', sublabel: 'back' },
  { label: 'Triceps Pushdown', sublabel: 'triceps' },
  { label: 'Plank', sublabel: 'core · Timed' },
];
const names = (query: string) => search(exercises, query).map((e) => e.label);

describe('edit distance', () => {
  it('counts added, missing, changed and swapped letters', () => {
    expect(editDistance('bench', 'bench')).toBe(0);
    expect(editDistance('bech', 'bench')).toBe(1);
    expect(editDistance('benchh', 'bench')).toBe(1);
    expect(editDistance('bunch', 'bench')).toBe(1);
    expect(editDistance('bnech', 'bench')).toBe(1);
    expect(editDistance('dumbell', 'dumbbell')).toBe(1);
  });

  it('gives up past the limit', () => {
    expect(editDistance('squat', 'deadlift', 2)).toBe(3);
    expect(editDistance('a', 'abcdef', 2)).toBe(3);
  });

  it('allows more slips in longer words, none in short ones', () => {
    expect(typoAllowance(3)).toBe(0);
    expect(typoAllowance(4)).toBe(1);
    expect(typoAllowance(6)).toBe(1);
    expect(typoAllowance(7)).toBe(2);
  });
});

describe('searching exercises', () => {
  it('still finds what is typed exactly, starts of names first', () => {
    expect(names('bench')).toEqual(['Barbell Bench Press', 'Dumbbell Bench Press']);
    expect(names('dumbbell')).toEqual(['Dumbbell Bench Press', 'Dumbbell Curl']);
    expect(names('curl')).toEqual(['Dumbbell Curl']);
  });

  it('forgives a letter or two', () => {
    expect(names('bech press')).toEqual(['Barbell Bench Press', 'Dumbbell Bench Press']);
    expect(names('dumbell curl')).toEqual(['Dumbbell Curl']);
    expect(names('romainian deadlfit')).toEqual(['Romanian Deadlift']);
    expect(names('tricep pushdwn')).toEqual(['Triceps Pushdown']);
    expect(names('palnk')).toEqual(['Plank']);
  });

  it("doesn't care about spaces and hyphens", () => {
    expect(names('pullup')).toEqual(['Pull-Up']);
    expect(names('pull up')).toEqual(['Pull-Up']);
    expect(names('lat pull down')).toEqual(['Lat Pulldown']);
  });

  it('matches a word still being typed, even with a slip in it', () => {
    expect(names('dumbe')).toEqual(['Dumbbell Bench Press', 'Dumbbell Curl']);
    expect(names('romanain')).toEqual(['Romanian Deadlift']);
  });

  it('searches the muscle group too', () => {
    expect(names('back')).toEqual(['Lat Pulldown', 'Pull-Up', 'Seated Cable Row']);
    expect(names('bicpes')).toEqual(['Dumbbell Curl']);
  });

  it('puts exact matches ahead of near misses', () => {
    const list = [{ label: 'Rope Pushdown' }, { label: 'Row' }];
    expect(search(list, 'row').map((e) => e.label)).toEqual(['Row']);
    expect(searchScore({ label: 'Bench Press' }, 'bench')).toBeLessThan(searchScore({ label: 'Bench Press' }, 'bnech')!);
  });

  it("doesn't let short words drift: three letters must be right", () => {
    expect(names('raw')).toEqual([]);
    expect(names('cur')).toEqual(['Dumbbell Curl']);
  });

  it('returns everything for a blank search, and nothing for nonsense', () => {
    expect(search(exercises, '   ')).toHaveLength(exercises.length);
    expect(names('zzzzzz')).toEqual([]);
  });

  it('normalizes accents and punctuation', () => {
    expect(normalize('  Pull-Up (Wide) ')).toBe('pull up wide');
    expect(normalize('Café')).toBe('cafe');
  });
});
