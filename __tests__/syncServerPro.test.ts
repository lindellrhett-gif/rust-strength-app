/** The app asks the server to refresh its Pro record (supabase/functions/sync-subscription). */
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));
jest.mock('@/lib/purchases', () => ({}));
jest.mock('@/lib/queryClient', () => ({ qk: {} }));
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => ({}) }));
jest.mock('@tanstack/react-query', () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the mocks above
const { syncServerPro } = require('@/data/subscription') as typeof import('@/data/subscription');

beforeEach(() => mockInvoke.mockReset());

test('calls sync-subscription with a POST', async () => {
  mockInvoke.mockResolvedValue({ data: { pro: true }, error: null });
  await syncServerPro();
  expect(mockInvoke).toHaveBeenCalledWith('sync-subscription', { method: 'POST' });
});

test('reports a failure, so callers can try again later', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new Error('not deployed') });
  await expect(syncServerPro()).rejects.toThrow('not deployed');
});
