import { MAX_DAILY_STEPS, STEP_DAYS, stepDays, stepsPayload } from '../src/domain/dailySteps';

describe('daily steps to share', () => {
  const now = new Date(2026, 9, 13, 15, 30); // 13 Oct 2026, 3:30 pm local

  it('covers today and the six days before, each from local midnight', () => {
    const days = stepDays(now);
    expect(days).toHaveLength(STEP_DAYS);
    expect(days[0].day).toBe('2026-10-13');
    expect(days[6].day).toBe('2026-10-07');
    expect(days[1].start).toBe(new Date(2026, 9, 12).getTime());
    expect(days[1].end).toBe(new Date(2026, 9, 13).getTime());
  });

  it('stops today at now, not at midnight', () => {
    expect(stepDays(now)[0].end).toBe(now.getTime());
  });

  it('crosses a month boundary', () => {
    expect(stepDays(new Date(2026, 10, 2, 9)).map((d) => d.day).slice(0, 3)).toEqual(['2026-11-02', '2026-11-01', '2026-10-31']);
  });

  it('leaves out days the phone could not count, and caps impossible ones', () => {
    const days = stepDays(now, 3);
    expect(stepsPayload(days, [8123.4, null, 250_000])).toEqual([
      { day: '2026-10-13', steps: 8123 },
      { day: '2026-10-11', steps: MAX_DAILY_STEPS },
    ]);
  });
});
