/**
 * Fixes from the November 17 review of 1.2: offline diary and profile writes
 * land in the order they were made, amounts the database would refuse are
 * caught on the phone, and a timeout isn't reported as no connection.
 */
import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';

import { emptyNutrients } from '../src/domain/nutrition/nutrients';
import { measure, type Food } from '../src/domain/nutrition/foods';
import { fetchProblem } from '../src/lib/fetchProblem';

const calls: string[] = [];
const mockTable = (table: string) => ({
  insert: async (row: { id: string }) => {
    // The insert is slower than the delete after it, as on a weak signal;
    // each write is recorded when it lands.
    await new Promise((done) => setTimeout(done, 30));
    calls.push(`${table}:insert:${row.id}`);
    return { error: null };
  },
  delete: () => ({
    eq: async (_col: string, id: string) => {
      calls.push(`${table}:delete:${id}`);
      return { error: null };
    },
  }),
  update: (patch: Record<string, unknown>) => ({
    eq: async () => {
      calls.push(`${table}:update:${JSON.stringify(patch)}`);
      return { error: null };
    },
  }),
});
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockTable(table),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } }, error: null }) },
  },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.0' } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {} }));
jest.mock('../src/lib/runStore', () => ({ runStore: { clear: async () => undefined } }));

// eslint-disable-next-line import/first -- after the mocks above
import { registerMutationDefaults } from '../src/data/mutationDefaults';
// eslint-disable-next-line import/first
import { mk, ms } from '../src/lib/queryClient';

describe('offline writes replay in order', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    calls.length = 0;
  });

  it('every diary and profile default carries its scope', () => {
    const client = new QueryClient();
    registerMutationDefaults(client);
    for (const key of [mk.logFood, mk.updateEntry, mk.deleteEntry, mk.addWater, mk.deleteWater, mk.saveWeighIn, mk.deleteWeighIn, mk.saveDiaryDay]) {
      expect(client.getMutationDefaults(key).scope).toEqual(ms.diary);
    }
    expect(client.getMutationDefaults(mk.updateProfile).scope).toEqual(ms.profile);
  });

  it('a food logged then deleted offline stays deleted', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    registerMutationDefaults(client);
    onlineManager.setOnline(false);

    const log = new MutationObserver(client, { mutationKey: mk.logFood });
    const remove = new MutationObserver(client, { mutationKey: mk.deleteEntry });
    const logged = log.mutate({ id: 'e1' } as never);
    const removed = remove.mutate({ id: 'e1' } as never);
    await new Promise((done) => setTimeout(done, 10));
    expect(calls).toEqual([]);

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await Promise.all([logged, removed]);
    expect(calls).toEqual(['diary_entries:insert:e1', 'diary_entries:delete:e1']);
  });

  it('two profile edits made offline land oldest first', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    registerMutationDefaults(client);
    onlineManager.setOnline(false);

    const first = new MutationObserver(client, { mutationKey: mk.updateProfile }).mutate({ rep_range: 'low' } as never);
    const second = new MutationObserver(client, { mutationKey: mk.updateProfile }).mutate({ rep_range: 'high' } as never);

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await Promise.all([first, second]);
    expect(calls).toEqual(['profiles:update:{"rep_range":"low"}', 'profiles:update:{"rep_range":"high"}']);
  });
});

describe('amounts the database would refuse', () => {
  const rice: Food = {
    id: 'rice', source: 'usda', barcode: null, name: 'Rice', brand: null, basis: '100g', servingLabel: null,
    servingG: null, servingMl: null, nutrients: { ...emptyNutrients(), kcal: 130 }, portions: [{ label: '1 cup', grams: 158 }],
  };

  it('a weight over 100 kg is refused, though the amount is allowed', () => {
    expect(measure(rice, 700, 'portion:1 cup')).toBeNull();
    expect(measure(rice, 600, 'portion:1 cup')?.grams).toBe(94800);
  });

  it('a weight that rounds to nothing is refused', () => {
    expect(measure(rice, 0.004, 'g')).toBeNull();
    expect(measure(rice, 0.01, 'g')?.grams).toBe(0.01);
  });
});

describe('why a request failed', () => {
  it('our own timeout is the server being slow, not the phone being offline', () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(fetchProblem(abort)).toBe('unavailable');
    expect(fetchProblem(new Error('The operation was aborted.'))).toBe('unavailable');
  });

  it('a failed connection is offline', () => {
    expect(fetchProblem(new TypeError('Network request failed'))).toBe('offline');
    expect(fetchProblem(new TypeError('Failed to fetch'))).toBe('offline');
  });

  it('anything else is unavailable', () => {
    expect(fetchProblem(new Error('Unexpected token <'))).toBe('unavailable');
    expect(fetchProblem('weird')).toBe('unavailable');
  });
});
