import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

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
      // Twice, or for about a minute while an expired session is refreshed.
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
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rust-strength-cache',
  // Batches writes; the cache changes on every keystroke in a search box.
  throttleTime: 2000,
});

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
};

/** Central place for query keys so invalidation stays consistent. */
export const qk = {
  profile: ['profile'] as const,
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
  runPreferences: ['run-preferences'] as const,
};
