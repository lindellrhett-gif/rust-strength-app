import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, defaultShouldDehydrateQuery, type QueryKey } from '@tanstack/react-query';
import type {
  PersistQueryClientOptions,
  Persister,
} from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';

import { retryDelay, shouldRetry } from './sessionGuard';

/** How long a cached answer is still worth showing while offline. */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Must outlive the persisted copy, or restored entries are collected
      // before they can be shown.
      gcTime: CACHE_MAX_AGE,
      // Twice, or for over a minute while an expired session is refreshed.
      retry: shouldRetry,
      retryDelay,
      refetchOnWindowFocus: false,
      // Fire once even with no connection, then stop retrying and keep serving
      // what is cached, rather than spinning against a dead network.
      networkMode: 'offlineFirst',
    },
    mutations: {
      // The default. A write started with no connection is *paused* rather than
      // failed, and resumes when the network returns — which is the whole point
      // of the offline queue.
      networkMode: 'online',
      retry: shouldRetry,
      retryDelay,
    },
  },
});

/**
 * The cache, written to the phone.
 *
 * Two jobs: the app opens and shows your training with no signal, and writes
 * queued in a dead spot survive the app being killed in your pocket.
 *
 * This puts training data on disk, so it MUST be cleared when the signed-in
 * account changes — see `AuthProvider`.
 */
const disk = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rust-strength-cache',
  // Batches writes; the cache changes on every keystroke in a search box.
  throttleTime: 2000,
});

/**
 * The app version that saved the cached answers on the phone. An answer saved by
 * an older version can be missing a field this version's screens expect, so it
 * isn't shown. Taken from the version so nobody has to remember to change it when
 * a query's shape changes. Builds of the same version aren't told apart.
 */
const CACHE_VERSION = Constants.expoConfig?.version ?? 'unknown';

/**
 * React Query's own `buster` and `maxAge` delete the whole stored copy, queued
 * writes included, and a set logged on the old version must still reach the
 * server. So an older or out-of-date copy is dealt with here first: the cached
 * answers go and the writes stay, which leaves those two checks nothing to act on.
 */
export const persister: Persister = {
  ...disk,
  restoreClient: async () => {
    const stored = await disk.restoreClient();
    if (!stored) return stored;
    const current =
      stored.buster === CACHE_VERSION && Date.now() - stored.timestamp <= CACHE_MAX_AGE;
    if (current) return stored;
    return {
      buster: CACHE_VERSION,
      timestamp: Date.now(),
      clientState: { ...stored.clientState, queries: [] },
    };
  },
};

/** What was typed into a search box: many entries, and no use the next time. */
function isTypedSearch(key: QueryKey): boolean {
  return key[0] === 'user-search' || (key[0] === 'foods' && key[1] === 'search');
}

/** For PersistQueryClientProvider in the root layout. */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: CACHE_VERSION,
  dehydrateOptions: {
    // Only writes waiting on a connection are worth storing. A write
    // that already landed, or one that failed outright, is not.
    shouldDehydrateMutation: (mutation) => mutation.state.isPaused,
    // Each launch restarts a restored entry's garbage-collection clock, so an
    // answer nothing has asked for in weeks would otherwise be kept forever, and
    // the whole cache is written out again on every change.
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) &&
      Date.now() - query.state.dataUpdatedAt <= CACHE_MAX_AGE &&
      !isTypedSearch(query.queryKey),
  },
};

/**
 * Picks the restored queue back up, once the cache is back.
 *
 * Don't wait on this: the provider holds every query back until its onSuccess has
 * settled, and sending the writes can take over a minute on a poor connection.
 *
 * A restored write has lost the hook that would refresh what it changed, and
 * reads race it, both at launch and when the signal returns. A read can overtake
 * the write, and a set looks gone until something refetches, which invites logging
 * it twice. Hence the refresh once they have all landed, however long that takes.
 */
export function resumeRestoredWrites(client: QueryClient): void {
  const cache = client.getMutationCache();
  const anyQueued = cache.getAll().some((mutation) => mutation.state.isPaused);
  void client.resumePausedMutations();
  if (!anyQueued) return;
  const unsubscribe = cache.subscribe(() => {
    if (client.isMutating() > 0) return;
    unsubscribe();
    void client.invalidateQueries();
  });
}

/**
 * Mutation keys for the writes that must survive going offline.
 *
 * A paused write is stored without its function, so on restart React Query
 * needs a registered default to know how to finish it. Only the logging loop
 * gets this treatment — it is the part someone does mid-session with no signal.
 */
export const mk = {
  addSet: ['mutation', 'add-set'] as const,
  startWorkout: ['mutation', 'start-workout'] as const,
  endWorkout: ['mutation', 'end-workout'] as const,
  /** A finished run, often saved right where the signal dropped. */
  saveRun: ['mutation', 'save-run'] as const,
  // The food diary: logged at the table or the counter, signal or not.
  logFood: ['mutation', 'log-food'] as const,
  updateEntry: ['mutation', 'update-entry'] as const,
  deleteEntry: ['mutation', 'delete-entry'] as const,
  addWater: ['mutation', 'add-water'] as const,
  deleteWater: ['mutation', 'delete-water'] as const,
  saveWeighIn: ['mutation', 'save-weigh-in'] as const,
  deleteWeighIn: ['mutation', 'delete-weigh-in'] as const,
  saveDiaryDay: ['mutation', 'save-diary-day'] as const,
};

/** Central place for query keys so invalidation stays consistent. */
export const qk = {
  profile: ['profile'] as const,
  /** The daily step goal, kept on the phone (src/data/stepGoal.ts). */
  stepGoal: ['stepGoal'] as const,
  exercises: ['exercises'] as const,
  gyms: ['gyms'] as const,
  machines: ['machines'] as const,
  workouts: ['workouts'] as const,
  openWorkout: ['workouts', 'open'] as const,
  workout: (id: string) => ['workouts', id] as const,
  setsForWorkout: (id: string) => ['sets', 'workout', id] as const,
  exerciseHistory: (id: string) => ['sets', 'exercise', id] as const,
  exerciseProgress: (id: string) => ['sets', 'progress', id] as const,
  machineHistory: ['sets', 'machines'] as const,
  totals: ['stats', 'totals'] as const,
  prs: ['stats', 'prs'] as const,
  workoutDates: ['stats', 'workout-dates'] as const,
  weeklyCoverage: (weekStart: string) => ['stats', 'coverage', weekStart] as const,
  planned: ['planned'] as const,
  friendships: ['friendships'] as const,
  userSearch: ['user-search'] as const,
  friendStats: (userId: string) => ['friend-stats', userId] as const,
  friendPRs: (userId: string) => ['friend-prs', userId] as const,
  leaderboard: (period: string) => ['leaderboard', period] as const,
  templates: ['templates'] as const,
  template: (id: string) => ['templates', id] as const,
  workoutExercises: (workoutId: string) => ['workout-exercises', workoutId] as const,
  activities: ['activities'] as const,
  activityTotals: ['activities', 'totals'] as const,
  activityDates: ['activities', 'dates'] as const,
  restDays: ['rest-days'] as const,
  blockedUsers: ['blocked-users'] as const,
  workoutSummary: (workoutId: string) => ['workout-summary', workoutId] as const,
  feed: ['feed'] as const,
  badges: (userId: string) => ['badges', userId] as const,
  runs: ['runs'] as const,
  run: (id: string) => ['runs', id] as const,
  runHistory: ['runs', '__history'] as const,
  privacyZones: ['privacy-zones'] as const,
  savedRoutes: ['saved-routes'] as const,
  savedRoute: (id: string) => ['saved-routes', id] as const,
  runPreferences: ['run-preferences'] as const,
  // Under 'activities', so logging or deleting one refreshes it too.
  trophyTotals: ['activities', 'trophy-totals'] as const,
  proStatus: ['subscription', 'status'] as const,
  // Nutrition. Everything a diary write touches sits under 'diary', so one
  // invalidation refreshes the day, the history and the reports.
  diaryEntries: (day: string) => ['diary', 'entries', day] as const,
  diaryRange: (from: string, to: string) => ['diary', 'range', from, to] as const,
  foodHistory: ['diary', 'history'] as const,
  diaryDay: (day: string) => ['diary', 'day', day] as const,
  water: (day: string) => ['diary', 'water', day] as const,
  weighIns: ['weigh-ins'] as const,
  nutritionSettings: ['nutrition', 'settings'] as const,
  nutritionGoals: ['nutrition', 'goals'] as const,
  foodSearch: (query: string) => ['foods', 'search', query] as const,
  food: (id: string) => ['foods', id] as const,
  /** An Open Food Facts product, by its barcode. */
  offFood: (barcode: string) => ['foods', 'off', barcode] as const,
  /** Your foods first, then Open Food Facts, for a scanned code. */
  barcodeFood: (barcode: string) => ['foods', 'barcode', barcode] as const,
  myFoods: ['foods', 'mine'] as const,
  recipe: (id: string) => ['foods', 'recipe', id] as const,
  savedMeals: ['saved-meals'] as const,
};
