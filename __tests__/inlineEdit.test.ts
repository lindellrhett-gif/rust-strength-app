import { editRepRange, parseInlineNumber } from '../src/domain/inlineEdit';

const rules = { min: 0, max: 1000, precision: 1 };

describe('parseInlineNumber', () => {
  it('reads a plain number', () => {
    expect(parseInlineNumber('185', rules)).toBe(185);
    expect(parseInlineNumber(' 185.5 ', rules)).toBe(185.5);
  });

  it('reads a decimal comma', () => {
    expect(parseInlineNumber('82,5', rules)).toBe(82.5);
  });

  it('reads a thousands comma', () => {
    expect(parseInlineNumber('10,000', { min: 1000, max: 50000 })).toBe(10000);
  });

  it('keeps it inside the limits', () => {
    expect(parseInlineNumber('5000', rules)).toBe(1000);
    expect(parseInlineNumber('-4', rules)).toBe(0);
  });

  it('rounds to the precision', () => {
    expect(parseInlineNumber('82.56', rules)).toBe(82.6);
    expect(parseInlineNumber('7.6', { min: 1, max: 200 })).toBe(8);
  });

  it('returns null for nothing or nonsense', () => {
    expect(parseInlineNumber('', rules)).toBeNull();
    expect(parseInlineNumber('   ', rules)).toBeNull();
    expect(parseInlineNumber('abc', rules)).toBeNull();
    expect(parseInlineNumber('1.2.3', rules)).toBeNull();
  });
});

describe('editRepRange', () => {
  it('changes one end when they do not cross', () => {
    expect(editRepRange([6, 8], 'low', 5)).toEqual([5, 8]);
    expect(editRepRange([6, 8], 'high', 12)).toEqual([6, 12]);
  });

  it('moves the other end when they would cross', () => {
    expect(editRepRange([6, 8], 'low', 12)).toEqual([12, 12]);
    expect(editRepRange([6, 8], 'high', 3)).toEqual([3, 3]);
  });
});
