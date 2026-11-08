/**
 * Force-quit and reopen, for real.
 *
 * Each `launch()` re-imports the app's modules from nothing, so there is a fresh
 * auth client and a fresh query cache over the same phone storage, and mounts the
 * real AuthProvider under the real persistence provider. supabase-js and TanStack
 * Query run for real. Only the phone's disk, the network and the clock are faked.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- a launch re-imports everything, after jest.resetModules */

const USER_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const WORKOUT = '11111111-0000-4000-8000-000000000001';
const SET_ID = '22222222-0000-4000-8000-000000000001';
const AUTH_KEY = 'sb-abcd-auth-token';
const CACHE_KEY = 'rust-strength-cache';
const ANON = 'anon-key';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const mockDisk = new Map<string, string>();
/** How long a read of each key takes, which decides who wins the race at launch. */
const mockReadDelay: Record<string, number> = {};
let mockAppVersion = '1.2.0';

jest.setTimeout(240_000);

// The real one runs operations on a serial queue, so a read sees the disk as it
// was when asked, however long the answer then takes to arrive.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      const value = mockDisk.get(key) ?? null;
      await new Promise<void>((done) => setTimeout(done, mockReadDelay[key] ?? 1));
      return value;
    },
    setItem: async (key: string, value: string) => {
      mockDisk.set(key, value);
    },
    removeItem: async (key: string) => {
      mockDisk.delete(key);
    },
  },
}));
jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
  Platform: { OS: 'ios' },
  TurboModuleRegistry: { get: () => null },
}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
// Native code AuthProvider's sign-in helpers import from 1.2 on, unused here.
jest.mock('expo', () => ({ requireOptionalNativeModule: () => null }));
jest.mock('expo-application', () => ({ applicationId: 'test' }), { virtual: true });
jest.mock('expo-crypto', () => ({}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { version: mockAppVersion };
    },
  },
}));
jest.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'https://abcd.supabase.co', supabaseAnonKey: 'anon-key' },
}));
jest.mock('@/lib/activeRun', () => ({
  discardActiveRun: jest.fn(async () => undefined),
  discardRunsNotOwnedBy: jest.fn(async () => undefined),
}));
jest.mock('@/lib/runStore', () => ({
  runStore: { clear: jest.fn(async () => undefined) },
}));

// --- The server -----------------------------------------------------------

function sessionFor(user: string, expiresIn = 3600) {
  return {
    access_token: `token-${user}`,
    refresh_token: `refresh-${user}`,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: {
      id: user,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${user}@example.com`,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
}

interface Server {
  /** Whether a request from the phone gets anywhere at all. */
  signal: boolean;
  /** False once the refresh token has been revoked. */
  refreshOk: boolean;
  /** Who a password sign-in or a refresh comes back as. */
  account: string;
  sets: Record<string, unknown>[];
  /** How long a write takes, so a read can overtake it. */
  writeDelay: number;
  /** Data requests that went out with the public key instead of a user token. */
  anonymous: string[];
}

let server: Server;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!server.signal) throw new TypeError('Network request failed');

  if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
    if (!server.refreshOk) {
      return json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    }
    return json(200, sessionFor(server.account));
  }
  if (url.includes('/auth/v1/token?grant_type=password')) return json(200, sessionFor(server.account));
  if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });

  if (url.includes('/rest/v1/')) {
    const method = init?.method ?? 'GET';
    const authorization = new Headers(init?.headers).get('Authorization');
    if (authorization === `Bearer ${ANON}`) {
      server.anonymous.push(`${method} ${url}`);
      return method === 'GET' ? json(200, []) : json(401, { code: '42501', message: 'row-level security' });
    }
    if (method === 'GET') return json(200, server.sets);
    if (server.writeDelay) await new Promise((done) => setTimeout(done, server.writeDelay));
    server.sets.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 201 });
  }
  throw new Error(`Unexpected request: ${url}`);
}

// --- The phone ------------------------------------------------------------

function signedIn(user: string, opts: { tokenAgeHours?: number } = {}) {
  const expiresIn = 3600 - (opts.tokenAgeHours ?? 0) * 3600;
  mockDisk.set(AUTH_KEY, JSON.stringify(sessionFor(user, expiresIn)));
}

function setRow(user = USER_A) {
  return {
    id: SET_ID,
    user_id: user,
    workout_id: WORKOUT,
    exercise_id: 'bench',
    machine_id: null,
    weight: 225,
    reps: 8,
  };
}

function snapshot() {
  const raw = mockDisk.get(CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

interface App {
  client: any;
  qk: any;
  auth: () => any;
  restoring: () => boolean;
  queued: () => number;
  cachedSetIds: () => string[] | undefined;
  logSet: () => void;
  wait: (ms: number) => Promise<void>;
  regainSignal: () => Promise<void>;
  /** NetInfo reporting in: until it does, React Query assumes the phone is online. */
  learnThereIsNoSignal: () => Promise<void>;
  /** Delivers an auth event to the listeners AuthProvider has registered. */
  authEvent: (event: string, session: unknown) => Promise<void>;
  quit: () => Promise<void>;
  activeRun: any;
}

async function launch(opts: { watchSets?: boolean; netInfoPending?: boolean } = {}): Promise<App> {
  jest.resetModules();
  const React = require('react');
  const renderer = require('react-test-renderer');
  const rq = require('@tanstack/react-query');
  const { PersistQueryClientProvider } = require('@tanstack/react-query-persist-client');
  const qc = require('@/lib/queryClient');
  const { registerMutationDefaults } = require('@/data/mutationDefaults');
  const { AuthProvider, useAuth } = require('@/providers/AuthProvider');
  const { supabase } = require('@/lib/supabase');

  rq.onlineManager.setOnline(server.signal || !!opts.netInfoPending);
  registerMutationDefaults(qc.queryClient);

  const authListeners: ((event: string, session: unknown) => void)[] = [];
  const subscribe = supabase.auth.onAuthStateChange.bind(supabase.auth);
  jest.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation((listener: any) => {
    authListeners.push(listener);
    return subscribe(listener);
  });

  const key = qc.qk.setsForWorkout(WORKOUT);
  let auth: any;
  let restoring = true;
  function Probe() {
    auth = useAuth();
    restoring = rq.useIsRestoring();
    rq.useQuery({
      queryKey: key,
      enabled: !!opts.watchSets && !!auth.userId,
      queryFn: async () => {
        const { data, error } = await supabase.from('sets').select('*').eq('workout_id', WORKOUT);
        if (error) throw error;
        return data;
      },
    });
    return null;
  }

  // In small steps: act holds React's updates until it ends, and a single long
  // step would run every effect after everything else, whatever the real order.
  const wait = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; ) {
      const step = elapsed < 2000 ? 10 : 500;
      await React.act(async () => {
        await jest.advanceTimersByTimeAsync(step);
      });
      elapsed += step;
    }
  };

  let root: any;
  await React.act(async () => {
    root = renderer.create(
      React.createElement(
        PersistQueryClientProvider,
        {
          // As app/_layout.tsx has it.
          client: qc.queryClient,
          persistOptions: qc.persistOptions,
          onSuccess: () => qc.resumeRestoredWrites(qc.queryClient),
        },
        React.createElement(AuthProvider, null, React.createElement(Probe)),
      ),
    );
  });

  return {
    client: qc.queryClient,
    qk: qc.qk,
    auth: () => auth,
    restoring: () => restoring,
    queued: () =>
      qc.queryClient
        .getMutationCache()
        .getAll()
        .filter((m: any) => m.state.isPaused).length,
    cachedSetIds: () => qc.queryClient.getQueryData(key)?.map((s: any) => s.id),
    logSet: () => {
      // What useAddSet does: into the cache for the screen, then the queue.
      qc.queryClient.setQueryData(key, (now: any[] = []) => [...now, setRow()]);
      void new rq.MutationObserver(qc.queryClient, { mutationKey: qc.mk.addSet })
        .mutate(setRow())
        .catch(() => undefined);
    },
    wait,
    regainSignal: async () => {
      server.signal = true;
      await React.act(async () => {
        rq.onlineManager.setOnline(true);
      });
    },
    learnThereIsNoSignal: async () => {
      await React.act(async () => {
        rq.onlineManager.setOnline(false);
      });
    },
    authEvent: async (event, session) => {
      await React.act(async () => {
        for (const listener of authListeners) listener(event, session);
      });
    },
    quit: async () => {
      await React.act(async () => {
        root.unmount();
      });
      // A killed app runs nothing more: no retries, no late write to the disk.
      jest.clearAllTimers();
    },
    activeRun: require('@/lib/activeRun'),
  };
}

/** Open the app with no signal, log a set, give it time to reach the disk, then kill it. */
async function logSetThenForceQuit() {
  const app = await launch();
  await app.wait(1000);
  expect(app.auth().userId).toBe(USER_A);
  app.logSet();
  await app.wait(3000);
  expect(snapshot().clientState.mutations).toHaveLength(1);
  await app.quit();
}

const RACE_ORDERS: [string, Record<string, number>][] = [
  ['the cache is restored before the session resolves', { [CACHE_KEY]: 5, [AUTH_KEY]: 100 }],
  ['the session resolves before the cache is restored', { [CACHE_KEY]: 500, [AUTH_KEY]: 1 }],
];

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-08T18:00:00Z') });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockDisk.clear();
  for (const key of Object.keys(mockReadDelay)) delete mockReadDelay[key];
  mockAppVersion = '1.2.0';
  server = {
    signal: false,
    refreshOk: true,
    account: USER_A,
    sets: [],
    writeDelay: 0,
    anonymous: [],
  };
  (globalThis as any).fetch = fakeFetch;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('a signed-in cold start', () => {
  describe.each(RACE_ORDERS)('when %s', (_name, delays) => {
    it('keeps the queued write and the cached data, in memory and on disk', async () => {
      signedIn(USER_A);
      await logSetThenForceQuit();

      Object.assign(mockReadDelay, delays);
      const app = await launch();
      await app.wait(5000);

      expect(app.auth().userId).toBe(USER_A);
      expect(app.queued()).toBe(1);
      expect(app.cachedSetIds()).toEqual([SET_ID]);
      expect(snapshot()?.clientState.mutations).toHaveLength(1);
    });

    it('sends the queued write once the signal is back', async () => {
      signedIn(USER_A);
      await logSetThenForceQuit();

      Object.assign(mockReadDelay, delays);
      const app = await launch();
      await app.wait(1000);
      await app.regainSignal();
      await app.wait(5000);

      expect(server.sets.map((s) => s.id)).toEqual([SET_ID]);
      expect(app.queued()).toBe(0);
      expect(server.anonymous).toEqual([]);
    });
  });

  it('keeps the write when the phone only learns it has no signal just after opening', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    // The first replay really does go out, and fails, before NetInfo has answered.
    const app = await launch({ netInfoPending: true });
    await app.wait(100);
    await app.learnThereIsNoSignal();
    await app.wait(5000);

    expect(app.queued()).toBe(1);
    expect(snapshot()?.clientState.mutations).toHaveLength(1);
  });
});

describe('with no signal and an access token over an hour old', () => {
  it('stays signed in, with the queue and the cache intact', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    jest.setSystemTime(Date.now() + 2 * HOUR);
    const app = await launch();
    // supabase-js spends about 25 seconds retrying the refresh before it answers.
    await app.wait(30_000);

    expect(app.auth().initializing).toBe(false);
    expect(app.auth().userId).toBe(USER_A);
    expect(app.queued()).toBe(1);
    expect(app.cachedSetIds()).toEqual([SET_ID]);
    expect(snapshot()?.clientState.mutations).toHaveLength(1);
  });

  it('is not moved by a late INITIAL_SESSION, which reads the same failure as no session', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    jest.setSystemTime(Date.now() + 2 * HOUR);
    const app = await launch();
    await app.wait(30_000);
    await app.authEvent('INITIAL_SESSION', null);
    await app.wait(1000);

    expect(app.auth().userId).toBe(USER_A);
    expect(app.queued()).toBe(1);
    expect(app.cachedSetIds()).toEqual([SET_ID]);
  });

  it('sends the write with a real token when the signal returns, right after a failed refresh', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    jest.setSystemTime(Date.now() + 2 * HOUR);
    const app = await launch();
    await app.wait(30_000);
    await app.regainSignal();
    // The auth client won't try again for a minute after a failed refresh.
    await app.wait(120_000);

    expect(app.auth().userId).toBe(USER_A);
    expect(server.anonymous).toEqual([]);
    expect(server.sets.map((s) => s.id)).toEqual([SET_ID]);
    expect(app.queued()).toBe(0);
    expect(app.cachedSetIds()).toEqual([SET_ID]);
  });

  it('wipes everything once the signal shows the session really has ended', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    jest.setSystemTime(Date.now() + 2 * HOUR);
    const app = await launch();
    await app.wait(30_000);
    server.refreshOk = false;
    await app.regainSignal();
    await app.wait(120_000);

    expect(app.auth().userId).toBeNull();
    expect(app.queued()).toBe(0);
    expect(app.cachedSetIds()).toBeUndefined();
    await app.wait(3000);
    expect(snapshot()?.clientState.queries ?? []).toEqual([]);
    expect(snapshot()?.clientState.mutations ?? []).toEqual([]);
  });

  it('does not invent a session for someone who is signed out', async () => {
    const app = await launch();
    await app.wait(1000);
    expect(app.auth().initializing).toBe(false);
    expect(app.auth().session).toBeNull();
  });
});

describe('a real change of account', () => {
  it('wipes the queue, the cache and the disk on sign-out', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    const app = await launch();
    await app.wait(1000);
    expect(app.queued()).toBe(1);

    server.signal = true;
    const signingOut = app.auth().signOut();
    await app.wait(3000);
    await signingOut;

    expect(app.auth().session).toBeNull();
    expect(app.queued()).toBe(0);
    expect(app.cachedSetIds()).toBeUndefined();
    expect(snapshot()?.clientState.queries ?? []).toEqual([]);
    expect(snapshot()?.clientState.mutations ?? []).toEqual([]);
  });

  it('wipes what the last person left when someone else signs in', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    // Their session ended while the app was closed, so the app opens signed out.
    mockDisk.delete(AUTH_KEY);
    const app = await launch();
    await app.wait(1000);
    expect(app.auth().session).toBeNull();

    server.signal = true;
    server.account = USER_B;
    const signingIn = app.auth().signIn('b@example.com', 'test-password');
    await app.wait(3000);
    await signingIn;

    expect(app.auth().userId).toBe(USER_B);
    expect(app.queued()).toBe(0);
    expect(app.cachedSetIds()).toBeUndefined();
    expect(snapshot()?.clientState.queries ?? []).toEqual([]);
    expect(snapshot()?.clientState.mutations ?? []).toEqual([]);
    expect(app.activeRun.discardRunsNotOwnedBy).toHaveBeenCalledWith(USER_B);
  });

  it('leaves everything alone on a routine token refresh', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    // Back with a signal an hour later: the session has to be refreshed first.
    jest.setSystemTime(Date.now() + 2 * HOUR);
    server.signal = true;
    const app = await launch();
    await app.wait(5000);

    expect(app.auth().userId).toBe(USER_A);
    expect(server.anonymous).toEqual([]);
    expect(server.sets.map((s) => s.id)).toEqual([SET_ID]);
    expect(app.cachedSetIds()).toEqual([SET_ID]);
    expect(app.activeRun.discardRunsNotOwnedBy).toHaveBeenCalledWith(USER_A);
  });
});

describe('a copy of the cache saved by another version', () => {
  /** The disk as a phone leaves it after a set is logged on the live app, 1.1.1. */
  async function leftByLiveApp() {
    signedIn(USER_A);
    await logSetThenForceQuit();
    const saved = snapshot();
    expect(saved.clientState.queries).toHaveLength(1);
    mockDisk.set(CACHE_KEY, JSON.stringify({ ...saved, buster: '' }));
  }

  it('drops the old answers but keeps the queued write', async () => {
    await leftByLiveApp();

    const app = await launch();
    await app.wait(1000);

    expect(app.cachedSetIds()).toBeUndefined();
    expect(app.queued()).toBe(1);
    await app.wait(3000);
    expect(snapshot().clientState.mutations).toHaveLength(1);
  });

  it('delivers that write once the signal is back', async () => {
    await leftByLiveApp();

    const app = await launch();
    await app.wait(1000);
    await app.regainSignal();
    await app.wait(5000);

    expect(server.sets.map((s) => s.id)).toEqual([SET_ID]);
    expect(app.queued()).toBe(0);
  });

  it('does the same when the app updates to a new version', async () => {
    signedIn(USER_A);
    mockAppVersion = '1.1.2';
    await logSetThenForceQuit();

    mockAppVersion = '1.2.0';
    const app = await launch();
    await app.wait(1000);

    expect(app.cachedSetIds()).toBeUndefined();
    expect(app.queued()).toBe(1);
  });

  it('keeps a queued write through a long gap between launches, but not the old answers', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    jest.setSystemTime(Date.now() + 8 * DAY);
    const app = await launch();
    await app.wait(30_000);

    expect(app.cachedSetIds()).toBeUndefined();
    expect(app.queued()).toBe(1);
  });
});

describe('replaying the restored queue', () => {
  it('refreshes the screen after the write lands, when a read overtook it', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    // Long enough that the restored answer is stale and gets refetched.
    jest.setSystemTime(Date.now() + 60_000);
    server.signal = true;
    server.writeDelay = 500;
    const app = await launch({ watchSets: true });
    // The launch's first read has come back, without the set still on its way.
    await app.wait(300);
    expect(app.cachedSetIds()).toEqual([]);

    await app.wait(3000);
    expect(server.sets.map((s) => s.id)).toEqual([SET_ID]);
    expect(app.cachedSetIds()).toEqual([SET_ID]);
  });

  it('does not hold the app back while a slow write is on its way', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    server.signal = true;
    server.writeDelay = 10_000;
    const app = await launch();
    await app.wait(1000);

    expect(server.sets).toEqual([]);
    expect(app.restoring()).toBe(false);
  });

  it('shows the set after reconnecting, when the app opened with no signal', async () => {
    signedIn(USER_A);
    await logSetThenForceQuit();

    jest.setSystemTime(Date.now() + 60_000);
    const app = await launch({ watchSets: true });
    await app.wait(1000);
    expect(app.cachedSetIds()).toEqual([SET_ID]);

    server.writeDelay = 500;
    await app.regainSignal();
    await app.wait(5000);

    expect(server.sets.map((s) => s.id)).toEqual([SET_ID]);
    expect(app.cachedSetIds()).toEqual([SET_ID]);
  });
});

describe('what gets written to the phone', () => {
  it('leaves out answers nobody has asked for in over a week, and typed searches', async () => {
    signedIn(USER_A);
    const app = await launch();
    await app.wait(1000);

    app.client.setQueryData(app.qk.profile, { user_id: USER_A });
    app.client.setQueryData(app.qk.gyms, [], { updatedAt: Date.now() - 8 * DAY });
    app.client.setQueryData([...app.qk.userSearch, 'bob'], []);
    app.client.setQueryData(['foods', 'search', 'banana'], []);
    await app.wait(3000);

    const kept = snapshot().clientState.queries.map((q: any) => q.queryKey[0]);
    expect(kept).toEqual(['profile']);
  });
});
