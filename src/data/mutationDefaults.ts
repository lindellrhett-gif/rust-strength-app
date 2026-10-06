import type { QueryClient } from '@tanstack/react-query';

import type { SaveRunInput } from '@/domain/running/save';
import { mk } from '@/lib/queryClient';
import { runStore } from '@/lib/runStore';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

export type SetInsert = Database['public']['Tables']['sets']['Insert'];
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert'];

/** Postgres unique_violation. */
const DUPLICATE_KEY = '23505';

/**
 * The writes in the logging loop, as plain functions with no hooks in them.
 *
 * A write started with no signal is paused and stored on disk, and what gets
 * stored is the *variables* — not the function. When the app restarts and
 * replays the queue, React Query needs a registered default to know how to
 * finish the job. That is what these are for, and it is why every one of them
 * takes a complete row: a resumed write has no component, no session hook and
 * no context to look anything up in.
 *
 * Each is safe to run twice. Ids are generated on the phone, so a replay that
 * overlaps something already delivered hits the primary key and is treated as
 * the success it is, rather than writing a second copy of the set.
 */

export async function insertSetRow(row: SetInsert): Promise<void> {
  const { error } = await supabase.from('sets').insert(row);
  if (error && error.code !== DUPLICATE_KEY) throw error;
}

export async function insertWorkoutRow(row: WorkoutInsert): Promise<void> {
  const { error } = await supabase.from('workouts').insert(row);
  if (error && error.code !== DUPLICATE_KEY) throw error;
}

export interface EndWorkoutInput {
  id: string;
  /** Stamped when the user tapped Finish, not when the write finally lands. */
  endedAt: string;
}

export async function endWorkoutRow({ id, endedAt }: EndWorkoutInput): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ ended_at: endedAt })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Saves a finished run: the activity, its route and its best efforts, in one
 * call. The id was chosen on the phone when the run started, so a replay of a
 * save that already landed returns the same run instead of a second copy.
 *
 * The recording stays on the phone until this succeeds, then is cleared. If
 * the app dies with the save still queued, the recording is still there to
 * save again on the next launch.
 */
export async function saveRunRow(input: SaveRunInput): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_save_run', input);
  if (error) throw error;
  await runStore.clear(input.p_id);
  return data;
}

/**
 * Must run before the persisted cache is restored, or a queue replayed at
 * startup finds no function to call and the writes are dropped.
 */
export function registerMutationDefaults(client: QueryClient): void {
  client.setMutationDefaults(mk.addSet, { mutationFn: insertSetRow });
  client.setMutationDefaults(mk.startWorkout, { mutationFn: insertWorkoutRow });
  client.setMutationDefaults(mk.endWorkout, { mutationFn: endWorkoutRow });
  client.setMutationDefaults(mk.saveRun, { mutationFn: saveRunRow });
}
