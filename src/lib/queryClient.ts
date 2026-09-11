import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

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
  totals: ['stats', 'totals'] as const,
  prs: ['stats', 'prs'] as const,
  workoutDates: ['stats', 'workout-dates'] as const,
  weeklyCoverage: (weekStart: string) => ['stats', 'coverage', weekStart] as const,
  planned: ['planned'] as const,
  friendships: ['friendships'] as const,
  userSearch: ['user-search'] as const,
  friendStats: (userId: string) => ['friend-stats', userId] as const,
  friendPRs: (userId: string) => ['friend-prs', userId] as const,
  templates: ['templates'] as const,
  template: (id: string) => ['templates', id] as const,
  workoutExercises: (workoutId: string) => ['workout-exercises', workoutId] as const,
  activities: ['activities'] as const,
  activityTotals: ['activities', 'totals'] as const,
  restDays: ['rest-days'] as const,
  blockedUsers: ['blocked-users'] as const,
  workoutSummary: (workoutId: string) => ['workout-summary', workoutId] as const,
  feed: ['feed'] as const,
  badges: (userId: string) => ['badges', userId] as const,
};
