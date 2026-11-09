import { readFileSync } from 'node:fs';

describe('the add-food sheet', () => {
  const screen = readFileSync('app/nutrition/add.tsx', 'utf8');
  const sheet = screen.slice(screen.indexOf('<FoodAmountSheet'), screen.indexOf('visible', screen.indexOf('<FoodAmountSheet')));

  it('is found', () => {
    expect(sheet).toMatch(/key=/);
  });

  // Changing the key while it opens swaps one native modal for another, and iOS
  // refuses the second while the first is moving. A food that wasn't cached yet
  // then vanished or froze on the first tap, and worked once it was cached. This
  // only reads the source, so it stops the old line coming back; it can't prove
  // what a phone does.
  it('keeps one key while its food loads', () => {
    expect(sheet).not.toMatch(/\bfood\b\s*\?/);
    expect(sheet).not.toMatch(/ready|loading/);
  });
});
