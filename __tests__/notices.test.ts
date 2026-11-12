import { readFileSync } from 'node:fs';

import { THIRD_PARTY_NOTICES } from '../src/legal/notices';

/**
 * The Acknowledgements are generated (npm run notices). These checks catch a
 * dependency added without regenerating them, and keep the food data credits
 * the sources ask for.
 */

/** In package.json but not in the iOS release bundle: build-only, debug-only, or web-only. */
const NOT_IN_RELEASE = ['@bacons/apple-targets', 'expo-dev-client', 'react-dom', 'react-hook-form', 'zod'];

describe('acknowledgements', () => {
  it('list every dependency the app ships', () => {
    const deps = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies as Record<string, string>);
    const missing = deps.filter((d) => !NOT_IN_RELEASE.includes(d) && !THIRD_PARTY_NOTICES.includes(`- ${d} `));
    expect(missing).toEqual([]);
  });

  it('list the native libraries that come from outside npm', () => {
    for (const name of ['RevenueCat and RevenueCatUI', 'PurchasesHybridCommon', 'ZXingObjC']) {
      expect(THIRD_PARTY_NOTICES).toContain(name);
    }
  });

  it('credit the food data the way its sources ask', () => {
    expect(THIRD_PARTY_NOTICES).toContain('Contains data from Open Food Facts, available under the Open Database License');
    expect(THIRD_PARTY_NOTICES).toContain('U.S. Department of Agriculture, Agricultural Research Service. FoodData Central');
  });

  it('stays out of the renderer’s way: no tables, and only the headings it writes', () => {
    const lines = THIRD_PARTY_NOTICES.split('\n');
    expect(lines.filter((l) => l.startsWith('|'))).toEqual([]);
    expect(lines.filter((l) => l.startsWith('#')).every((l) => /^#{1,3} \S/.test(l))).toBe(true);
  });
});
