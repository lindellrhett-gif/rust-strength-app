import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cleanStepGoal } from '@/domain/todayTiles';
import { qk } from '@/lib/queryClient';

/**
 * The daily step goal is kept on the phone, beside the step counts it's
 * measured against (they never leave the phone either; see src/lib/steps.ts).
 * Nothing about it is sent to the server.
 */
const STEP_GOAL_KEY = 'steps:daily-goal';

/** Today's step goal: 10,000 until the person picks their own. */
export function useStepGoal() {
  return useQuery({
    queryKey: qk.stepGoal,
    queryFn: async () => cleanStepGoal(await AsyncStorage.getItem(STEP_GOAL_KEY)),
    staleTime: Infinity,
  });
}

export function useSetStepGoal() {
  const client = useQueryClient();
  return useMutation({
    // Only ever touches the phone, so it needn't wait for a signal.
    networkMode: 'always',
    mutationFn: async (goal: number) => {
      const clean = cleanStepGoal(goal);
      await AsyncStorage.setItem(STEP_GOAL_KEY, String(clean));
      return clean;
    },
    onSuccess: (goal) => client.setQueryData(qk.stepGoal, goal),
  });
}
