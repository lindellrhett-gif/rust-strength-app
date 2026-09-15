import { readFileSync } from 'node:fs';

import { TAB_TITLES, tabTitle } from '../src/domain/tabs';

describe('tabTitle', () => {
  it('names each tab', () => {
    expect(tabTitle('index')).toBe('Today');
    expect(tabTitle('calendar')).toBe('Calendar');
    expect(tabTitle('stats')).toBe('Stats');
    expect(tabTitle('friends')).toBe('Friends');
    expect(tabTitle('profile')).toBe('Profile');
  });

  it('falls back to Today before any tab has focus', () => {
    expect(tabTitle(undefined)).toBe('Today');
  });

  it('never shows a raw route or group name', () => {
    for (const odd of ['(tabs)', '', 'toString', '__proto__', 'settings']) {
      const label = tabTitle(odd);
      expect(Object.values(TAB_TITLES)).toContain(label);
      expect(label).not.toMatch(/[()]/);
    }
  });
});

describe('tab layout', () => {
  it('declares a screen for every titled tab, and no untitled ones', () => {
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    const declared = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(TAB_TITLES).sort());
  });

  it('gives the (tabs) group a title in the root stack', () => {
    const root = readFileSync('app/_layout.tsx', 'utf8');
    expect(root).toMatch(/name="\(tabs\)"[\s\S]{0,80}options=/);
  });
});
