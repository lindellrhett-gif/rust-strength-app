import { cueFor, spokenDuration } from '../src/domain/running/cues';
import type { Split } from '../src/domain/running/splits';

const split = (index: number, seconds: number, partial = false): Split => ({
  index,
  distanceM: partial ? 300 : 1609.344,
  seconds,
  elevationChangeM: null,
  partial,
});

describe('spoken durations', () => {
  it('reads like speech, not a clock', () => {
    expect(spokenDuration(485)).toBe('8 minutes 5 seconds');
    expect(spokenDuration(61)).toBe('1 minute 1 second');
    expect(spokenDuration(3600)).toBe('1 hour');
    expect(spokenDuration(3725)).toBe('1 hour 2 minutes 5 seconds');
    expect(spokenDuration(0)).toBe('0 seconds');
  });
});

describe('what to say as the miles go by', () => {
  it('announces the first mile with time and pace', () => {
    const cue = cueFor(1650, 500, [split(1, 490), split(2, 10, true)], 'mi', 0);
    expect(cue).toEqual({
      split: 1,
      text: '1 mile. Time, 8 minutes 20 seconds. Average pace, 8 minutes 8 seconds per mile.',
    });
  });

  it('adds the last mile’s time from the second mile on', () => {
    const cue = cueFor(3300, 1000, [split(1, 490), split(2, 495), split(3, 15, true)], 'mi', 1);
    expect(cue?.text).toContain('2 miles.');
    expect(cue?.text).toContain('Last mile, 8 minutes 15 seconds.');
  });

  it('says each mile once', () => {
    expect(cueFor(1700, 520, [split(1, 490)], 'mi', 1)).toBeNull();
  });

  it('says nothing before the first one', () => {
    expect(cueFor(1500, 450, [], 'mi', 0)).toBeNull();
  });

  it('after a gap, announces only where the runner is now', () => {
    expect(cueFor(3300, 1000, [split(1, 490), split(2, 495)], 'mi', 0)?.split).toBe(2);
  });

  it('works in kilometres', () => {
    const cue = cueFor(1010, 300, [], 'km', 0);
    expect(cue?.text).toBe('1 kilometre. Time, 5 minutes. Average pace, 4 minutes 57 seconds per kilometre.');
  });
});
