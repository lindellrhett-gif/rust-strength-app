import { canPlanOn } from '../src/domain/planning';

describe('which days can be planned', () => {
  const today = '2026-10-10';

  it('allows today and any day after it', () => {
    expect(canPlanOn('2026-10-10', today)).toBe(true);
    expect(canPlanOn('2026-10-11', today)).toBe(true);
    expect(canPlanOn('2027-01-01', today)).toBe(true);
  });

  it('refuses a day that has already passed', () => {
    expect(canPlanOn('2026-10-09', today)).toBe(false);
    expect(canPlanOn('2025-12-31', today)).toBe(false);
  });
});
