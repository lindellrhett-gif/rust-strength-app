import { startingUnits } from '@/domain/units';

describe('startingUnits', () => {
  it('starts a US phone in pounds and calories, as the app always has', () => {
    expect(startingUnits('us', 'US')).toEqual({ weight: 'lb', energy: 'kcal' });
  });

  it('starts a metric phone in kilograms', () => {
    expect(startingUnits('metric', 'DE')).toEqual({ weight: 'kg', energy: 'kcal' });
    expect(startingUnits('metric', 'CA')).toEqual({ weight: 'kg', energy: 'kcal' });
  });

  it('treats the UK setting as metric', () => {
    expect(startingUnits('uk', 'GB').weight).toBe('kg');
  });

  it('uses kilojoules in Australia and New Zealand', () => {
    expect(startingUnits('metric', 'AU')).toEqual({ weight: 'kg', energy: 'kj' });
    expect(startingUnits('metric', 'NZ')).toEqual({ weight: 'kg', energy: 'kj' });
    expect(startingUnits('metric', 'au').energy).toBe('kj');
  });

  it('follows the measurement setting, not the region, for weight', () => {
    // An American in the US who switched the phone to metric.
    expect(startingUnits('metric', 'US').weight).toBe('kg');
    // Someone in Australia who switched it to US units still sees kilojoules on labels.
    expect(startingUnits('us', 'AU')).toEqual({ weight: 'lb', energy: 'kj' });
  });

  it('falls back to the US units when the phone says nothing', () => {
    expect(startingUnits(null, null)).toEqual({ weight: 'lb', energy: 'kcal' });
    expect(startingUnits('imperial', '')).toEqual({ weight: 'lb', energy: 'kcal' });
  });
});
