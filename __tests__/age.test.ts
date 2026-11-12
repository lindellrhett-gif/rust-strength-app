import { EEA_REGIONS, ageConfirmationLabel, isEeaRegion, minimumAgeFor } from '../src/domain/age';
import { LEGAL } from '../src/legal/config';

describe('minimumAgeFor', () => {
  it('asks for 16 in the EU and the rest of the EEA', () => {
    for (const region of ['DE', 'FR', 'IE', 'NL', 'PL', 'SE', 'IS', 'LI', 'NO']) {
      expect(minimumAgeFor(region)).toBe(16);
    }
  });

  it('covers the parts of the EU that carry their own codes', () => {
    for (const region of ['AX', 'GF', 'GP', 'MQ', 'YT', 'RE', 'MF']) {
      expect(minimumAgeFor(region)).toBe(16);
    }
  });

  it('asks for 14 in Canada, for Quebec', () => {
    expect(minimumAgeFor('CA')).toBe(14);
    expect(minimumAgeFor('ca')).toBe(14);
    expect(ageConfirmationLabel('CA')).toBe('I am at least 14 years old');
  });

  it('keeps 13 everywhere else, the UK and Switzerland included', () => {
    for (const region of ['US', 'GB', 'AU', 'NZ', 'CH', 'JP']) {
      expect(minimumAgeFor(region)).toBe(13);
    }
  });

  it('falls back to 13 when the region is unknown', () => {
    expect(minimumAgeFor(null)).toBe(13);
    expect(minimumAgeFor(undefined)).toBe(13);
    expect(minimumAgeFor('')).toBe(13);
  });

  it('reads codes regardless of case and spacing', () => {
    expect(minimumAgeFor('de')).toBe(16);
    expect(minimumAgeFor(' fr ')).toBe(16);
    expect(isEeaRegion('gb')).toBe(false);
  });

  it('uses the ages the documents print', () => {
    expect(LEGAL.minimumAge).toBe(13);
    expect(LEGAL.minimumAgeEea).toBe(16);
    expect(LEGAL.minimumAgeCanada).toBe(14);
  });

  it('lists the 27 member states, 7 outermost codes and 3 other EEA states', () => {
    expect(EEA_REGIONS.size).toBe(37);
  });
});

describe('ageConfirmationLabel', () => {
  it('names the age that applies', () => {
    expect(ageConfirmationLabel('NL')).toBe('I am at least 16 years old');
    expect(ageConfirmationLabel('US')).toBe('I am at least 13 years old');
  });
});
