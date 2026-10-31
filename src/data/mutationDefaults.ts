import type { QueryClient } from '@tanstack/react-query';

import type { SaveRunInput } from '@/domain/running/save';
import { mk } from '@/lib/queryClient';
import { runStore } from '@/lib/runStore';
import { supabase } from '@/lib/supabase';
import type { Database, DiaryEntryInsert } from '@/lib/database.types';

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

// --- Nutrition (0027) -----------------------------------------------------
// The diary is logged the same way as sets: ids made on the phone, writes
// never awaited, and each function safe to run twice.

export type DiaryEntryUpdate = Database['public']['Tables']['diary_entries']['Update'];
export type WaterInsert = Database['public']['Tables']['water_logs']['Insert'];

export async function insertDiaryEntryRow(row: DiaryEntryInsert): Promise<void> {
  const { error } = await supabase.from('diary_entries').insert(row);
  if (error && error.code !== DUPLICATE_KEY) throw error;
}

export async function updateDiaryEntryRow({ id, patch }: { id: string; patch: DiaryEntryUpdate }): Promise<void> {
  const { error } = await supabase.from('diary_entries').update(patch).eq('id', id);
  if (error) throw error;
}

/** Deleting what is already gone (or never arrived) is a success. */
export async function deleteDiaryEntryRow({ id }: { id: string }): Promise<void> {
  const { error } = await supabase.from('diary_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function insertWaterRow(row: WaterInsert): Promise<void> {
  const { error } = await supabase.from('water_logs').insert(row);
  if (error && error.code !== DUPLICATE_KEY) throw error;
}

export async function deleteWaterRow({ id }: { id: string }): Promise<void> {
  const { error } = await supabase.from('water_logs').delete().eq('id', id);
  if (error) throw error;
}

export interface WeighInInput {
  user_id: string;
  measured_on: string;
  kg: number;
}

/** One weigh-in a day: a second one that day replaces the first. */
export async function saveWeighInRow(row: WeighInInput): Promise<void> {
  const { error } = await supabase.from('body_weights').upsert(row, { onConflict: 'user_id,measured_on' });
  if (error) throw error;
}

export async function deleteWeighInRow({ userId, measuredOn }: { userId: string; measuredOn: string }): Promise<void> {
  const { error } = await supabase
    .from('body_weights')
    .delete()
    .eq('user_id', userId)
    .eq('measured_on', measuredOn);
  if (error) throw error;
}

export interface DiaryDayInput {
  user_id: string;
  day: string;
  note: string | null;
  completed_at: string | null;
}

export async function saveDiaryDayRow(row: DiaryDayInput): Promise<void> {
  const { error } = await supabase.from('diary_days').upsert(row, { onConflict: 'user_id,day' });
  if (error) throw error;
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
  client.setMutationDefaults(mk.logFood, { mutationFn: insertDiaryEntryRow });
  client.setMutationDefaults(mk.updateEntry, { mutationFn: updateDiaryEntryRow });
  client.setMutationDefaults(mk.deleteEntry, { mutationFn: deleteDiaryEntryRow });
  client.setMutationDefaults(mk.addWater, { mutationFn: insertWaterRow });
  client.setMutationDefaults(mk.deleteWater, { mutationFn: deleteWaterRow });
  client.setMutationDefaults(mk.saveWeighIn, { mutationFn: saveWeighInRow });
  client.setMutationDefaults(mk.deleteWeighIn, { mutationFn: deleteWeighInRow });
  client.setMutationDefaults(mk.saveDiaryDay, { mutationFn: saveDiaryDayRow });
}
