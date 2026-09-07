import { elapsedSeconds, formatClock, formatDurationShort } from '@/domain/duration';

describe('elapsedSeconds', () => {
  it('counts whole seconds between two instants', () => {
    expect(elapsedSeconds('2026-09-06T10:00:00Z', '2026-09-06T10:01:30Z')).toBe(90);
  });

  it('never goes negative when the end precedes the start', () => {
    expect(elapsedSeconds('2026-09-06T10:05:00Z', '2026-09-06T10:00:00Z')).toBe(0);
  });

  it('returns 0 for unparseable input', () => {
    expect(elapsedSeconds('not-a-date', '2026-09-06T10:00:00Z')).toBe(0);
  });
});

describe('formatClock', () => {
  it('uses M:SS below an hour', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(3599)).toBe('59:59');
  });

  it('uses H:MM:SS at and above an hour', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3661)).toBe('1:01:01');
  });

  it('is safe with junk input', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(NaN)).toBe('0:00');
  });
});

describe('formatDurationShort', () => {
  it('formats minutes, hours and both', () => {
    expect(formatDurationShort(45 * 60)).toBe('45m');
    expect(formatDurationShort(2 * 3600)).toBe('2h');
    expect(formatDurationShort(2 * 3600 + 30 * 60)).toBe('2h 30m');
  });

  it('shows <1m for sub-minute totals', () => {
    expect(formatDurationShort(0)).toBe('<1m');
    expect(formatDurationShort(59)).toBe('<1m');
  });
});
