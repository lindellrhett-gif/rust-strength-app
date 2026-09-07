import { roundToIncrement, clamp } from '@/domain/rounding';

describe('roundToIncrement', () => {
  it('rounds to the nearest multiple by default', () => {
    expect(roundToIncrement(152.6, 5)).toBe(155);
    expect(roundToIncrement(151, 5)).toBe(150);
    expect(roundToIncrement(12.4, 2.5)).toBe(12.5);
  });

  it('never rounds above the value when bias is "down"', () => {
    expect(roundToIncrement(154, 5, 'down')).toBe(150);
    expect(roundToIncrement(150, 5, 'down')).toBe(150);
  });

  it('never rounds below the value when bias is "up"', () => {
    expect(roundToIncrement(151, 5, 'up')).toBe(155);
    expect(roundToIncrement(150, 5, 'up')).toBe(150);
  });

  it('falls back to whole numbers for a non-positive increment', () => {
    expect(roundToIncrement(47.6, 0)).toBe(48);
    expect(roundToIncrement(47.6, -5)).toBe(48);
  });

  it('handles non-finite input safely', () => {
    expect(roundToIncrement(NaN, 5)).toBe(0);
    expect(roundToIncrement(Infinity, 5)).toBe(0);
  });

  it('is free of floating-point dust', () => {
    expect(roundToIncrement(47.0000001, 2.5)).toBe(47.5);
    expect(Number.isInteger(roundToIncrement(100.1, 1))).toBe(true);
  });

  it('never returns a negative number', () => {
    expect(roundToIncrement(-10, 5)).toBe(0);
  });
});

describe('clamp', () => {
  it('bounds a value into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('returns the value unchanged when bounds are inverted', () => {
    expect(clamp(5, 10, 0)).toBe(5);
  });
});
