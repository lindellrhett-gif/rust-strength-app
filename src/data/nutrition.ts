/**
 * The food diary's reads and writes (migration 0027).
 *
 * Logging works like logging a set: every write here is synchronous. The
 * row goes straight into the cache, the screen moves on, and the write
 * reaches the server whenever there is a connection, even after the app has
 * been closed (see mutationDefaults.ts). Settings and goals are ordinary
 * writes; nobody sets a goal mid-meal with no signal.
 *
 * Whether someone may use the diary at all is the screens' question
 * (`hasFeature('nutrition')`), as for every Pro feature.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { DiaryEntry } from '@/domain/nutrition/entries';
import type { Food } from '@/domain/nutrition/foods';
import { canonicalBarcode } from '@/domain/nutrition/openFoodFacts';
import type { NutritionSettings, WaterLog, WeighIn } from '@/domain/nutrition/settings';
import type { NutritionGoal } from '@/domain/nutrition/totals';
import { toLocalDateString } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { mk, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

import {
  deleteDiaryEntryRow,
  deleteWaterRow,
  deleteWeighInRow,
  insertDiaryEntryRow,
  insertWaterRow,
  saveDiaryDayRow,
  saveWeighInRow,
  updateDiaryEntryRow,
} from './mutationDefaults';
import {
  diaryDayFromRow,
  entryFromRow,
  entryPatch,
  entryToRow,
  foodFromRow,
  goalFromRow,
  goalToRow,
  settingsFromRow,
  settingsToRow,
  waterFromRow,
  weighInFromRow,
} from './nutritionRows';

/** How far back recent and frequent foods look. */
export const HISTORY_DAYS = 90;
const HISTORY_LIMIT = 1000;

const byMealThenTime = (a: DiaryEntry, b: DiaryEntry) => a.meal - b.meal || a.loggedAt.localeCompare(b.loggedAt);
const newestFirst = (a: DiaryEntry, b: DiaryEntry) => b.loggedAt.localeCompare(a.loggedAt);

// --- Settings and goals -------------------------------------------------------

export function useNutritionSettings() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.nutritionSettings,
    enabled: !!userId,
    queryFn: async (): Promise<NutritionSettings> => {
      const { data, error } = await supabase.from('nutrition_settings').select('*').maybeSingle();
      if (error) throw error;
      return settingsFromRow(data);
    },
  });
}

export function useSaveNutritionSettings() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Partial<NutritionSettings>) => {
      const { error } = await supabase
        .from('nutrition_settings')
        .upsert(
          { user_id: userId!, ...settingsToRow(changes), updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.nutritionSettings }),
  });
}

/** Every goal, oldest first; `goalFor` picks the one in force on a day. */
export function useNutritionGoals() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.nutritionGoals,
    enabled: !!userId,
    queryFn: async (): Promise<NutritionGoal[]> => {
      const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .order('starts_on', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(goalFromRow);
    },
  });
}

/** A new goal from a date on. Setting one twice the same day replaces it. */
export function useSaveNutritionGoal() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ goal, macroMode }: { goal: NutritionGoal; macroMode: 'percent' | 'grams' }) => {
      const { error } = await supabase
        .from('nutrition_goals')
        .upsert(goalToRow(goal, userId!, macroMode), { onConflict: 'user_id,starts_on' });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.nutritionGoals }),
  });
}

// --- The diary -------------------------------------------------------------------

/** One day's entries, by meal, in the order they were logged. */
export function useDiaryEntries(day: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.diaryEntries(day),
    enabled: !!userId,
    queryFn: async (): Promise<DiaryEntry[]> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('day', day)
        .order('meal')
        .order('logged_at');
      if (error) throw error;
      return (data ?? []).map(entryFromRow);
    },
  });
}

/** Every entry from `from` to `to` (local dates, inclusive), for reports. */
export function useDiaryRange(from: string, to: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.diaryRange(from, to),
    enabled: !!userId && from <= to,
    queryFn: async (): Promise<DiaryEntry[]> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .gte('day', from)
        .lte('day', to)
        .order('day')
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map(entryFromRow);
    },
  });
}

/** The last 90 days, newest first: what recent and frequent foods are worked out from. */
export function useFoodHistory() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.foodHistory,
    enabled: !!userId,
    queryFn: async (): Promise<DiaryEntry[]> => {
      const since = toLocalDateString(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .gte('day', since)
        .neq('source', 'quick')
        .order('logged_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw error;
      return (data ?? []).map(entryFromRow);
    },
  });
}

/**
 * Log entries: one food, a copied meal or a saved meal. Synchronous, like
 * `useAddSet`: the entries show at once and reach the server when they can.
 */
export function useLogEntries() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.logFood,
    mutationFn: insertDiaryEntryRow,
    onSettled: (_d, _e, row) => {
      client.invalidateQueries({ queryKey: qk.diaryEntries(row.day) });
      client.invalidateQueries({ queryKey: ['diary', 'range'] });
    },
  });

  const log = useCallback(
    (entries: readonly DiaryEntry[]) => {
      if (!userId || entries.length === 0) return;
      // Only lists already on the phone are changed: a day never loaded here
      // would otherwise show just these entries until it was fetched.
      for (const day of new Set(entries.map((e) => e.day))) {
        client.setQueryData<DiaryEntry[]>(qk.diaryEntries(day), (current) =>
          current && [...current, ...entries.filter((e) => e.day === day)].sort(byMealThenTime));
      }
      client.setQueryData<DiaryEntry[]>(qk.foodHistory, (current) =>
        current && [...entries.filter((e) => e.source !== 'quick'), ...current].sort(newestFirst));
      for (const entry of entries) mutation.mutate(entryToRow(entry, userId));
    },
    [userId, client, mutation],
  );

  return { log, error: mutation.error };
}

/** Change an entry's amount, meal or day. `before` is the entry as it was. */
export function useUpdateEntry() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.updateEntry,
    mutationFn: updateDiaryEntryRow,
    onSettled: () => client.invalidateQueries({ queryKey: ['diary'] }),
  });

  const update = useCallback(
    (before: DiaryEntry, after: DiaryEntry) => {
      client.setQueryData<DiaryEntry[]>(qk.diaryEntries(before.day), (current) =>
        current?.filter((e) => e.id !== before.id).concat(after.day === before.day ? [after] : []).sort(byMealThenTime));
      if (after.day !== before.day) {
        client.setQueryData<DiaryEntry[]>(qk.diaryEntries(after.day), (current) =>
          current && [...current.filter((e) => e.id !== after.id), after].sort(byMealThenTime));
      }
      client.setQueryData<DiaryEntry[]>(qk.foodHistory, (current) =>
        current?.map((e) => (e.id === after.id ? after : e)));
      mutation.mutate({ id: after.id, patch: entryPatch(after) });
    },
    [client, mutation],
  );

  return { update, error: mutation.error };
}

export function useDeleteEntry() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.deleteEntry,
    mutationFn: deleteDiaryEntryRow,
    onSettled: () => client.invalidateQueries({ queryKey: ['diary'] }),
  });

  const remove = useCallback(
    (entry: DiaryEntry) => {
      client.setQueryData<DiaryEntry[]>(qk.diaryEntries(entry.day), (current) =>
        current?.filter((e) => e.id !== entry.id));
      client.setQueryData<DiaryEntry[]>(qk.foodHistory, (current) => current?.filter((e) => e.id !== entry.id));
      mutation.mutate({ id: entry.id });
    },
    [client, mutation],
  );

  return { remove, error: mutation.error };
}

/** A day's note, and whether it was marked complete. */
export function useDiaryDay(day: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.diaryDay(day),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('diary_days').select('*').eq('day', day).maybeSingle();
      if (error) throw error;
      return diaryDayFromRow(data);
    },
  });
}

export function useSaveDiaryDay() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.saveDiaryDay,
    mutationFn: saveDiaryDayRow,
    onSettled: (_d, _e, row) => client.invalidateQueries({ queryKey: qk.diaryDay(row.day) }),
  });

  const save = useCallback(
    (day: string, value: { note: string | null; completedAt: string | null }) => {
      if (!userId) return;
      const note = value.note?.trim() ? value.note.trim().slice(0, 2000) : null;
      client.setQueryData(qk.diaryDay(day), { note, completedAt: value.completedAt });
      mutation.mutate({ user_id: userId, day, note, completed_at: value.completedAt });
    },
    [userId, client, mutation],
  );

  return { save, error: mutation.error };
}

// --- Water -------------------------------------------------------------------------

export function useWater(day: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.water(day),
    enabled: !!userId,
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await supabase.from('water_logs').select('*').eq('day', day).order('logged_at');
      if (error) throw error;
      return (data ?? []).map(waterFromRow);
    },
  });
}

export function useAddWater() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.addWater,
    mutationFn: insertWaterRow,
    onSettled: (_d, _e, row) => client.invalidateQueries({ queryKey: qk.water(row.day) }),
  });

  const add = useCallback(
    (day: string, ml: number) => {
      if (!userId || !(ml > 0)) return;
      const log: WaterLog = { id: newId(), day, ml: Math.round(ml), loggedAt: new Date().toISOString() };
      client.setQueryData<WaterLog[]>(qk.water(day), (current) => current && [...current, log]);
      mutation.mutate({ id: log.id, user_id: userId, day, ml: log.ml, logged_at: log.loggedAt });
    },
    [userId, client, mutation],
  );

  return { add, error: mutation.error };
}

export function useDeleteWater() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.deleteWater,
    mutationFn: deleteWaterRow,
    onSettled: () => client.invalidateQueries({ queryKey: ['diary', 'water'] }),
  });

  const remove = useCallback(
    (log: WaterLog) => {
      client.setQueryData<WaterLog[]>(qk.water(log.day), (current) => current?.filter((l) => l.id !== log.id));
      mutation.mutate({ id: log.id });
    },
    [client, mutation],
  );

  return { remove, error: mutation.error };
}

// --- Weigh-ins -------------------------------------------------------------------

/** Newest first. */
export function useWeighIns() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.weighIns,
    enabled: !!userId,
    queryFn: async (): Promise<WeighIn[]> => {
      const { data, error } = await supabase
        .from('body_weights')
        .select('*')
        .order('measured_on', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map(weighInFromRow);
    },
  });
}

/**
 * Save the day's weigh-in, replacing any earlier one that day. The latest
 * weigh-in also becomes the profile's bodyweight (a database trigger), so the
 * profile is refreshed once the write lands.
 */
export function useSaveWeighIn() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.saveWeighIn,
    mutationFn: saveWeighInRow,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.weighIns });
      client.invalidateQueries({ queryKey: qk.profile });
    },
  });

  const save = useCallback(
    (measuredOn: string, kg: number) => {
      if (!userId) return;
      const rounded = Math.round(kg * 100) / 100;
      client.setQueryData<WeighIn[]>(qk.weighIns, (current) =>
        current &&
        [
          // Its real id comes from the server; until then it is known by its day.
          { id: `local:${measuredOn}`, measuredOn, kg: rounded },
          ...current.filter((w) => w.measuredOn !== measuredOn),
        ].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn)));
      mutation.mutate({ user_id: userId, measured_on: measuredOn, kg: rounded });
    },
    [userId, client, mutation],
  );

  return { save, error: mutation.error };
}

export function useDeleteWeighIn() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mk.deleteWeighIn,
    mutationFn: deleteWeighInRow,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.weighIns });
      client.invalidateQueries({ queryKey: qk.profile });
    },
  });

  const remove = useCallback(
    (weighIn: WeighIn) => {
      if (!userId) return;
      client.setQueryData<WeighIn[]>(qk.weighIns, (current) => current?.filter((w) => w.measuredOn !== weighIn.measuredOn));
      mutation.mutate({ userId, measuredOn: weighIn.measuredOn });
    },
    [userId, client, mutation],
  );

  return { remove, error: mutation.error };
}

// --- Foods ---------------------------------------------------------------------------

/** Below this, a search matches too much to be useful. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * The catalog and your own foods matching a search (rpc_search_foods). Needs
 * a connection; offline, recent and frequent foods still work from the cache.
 * Results come without portions; `useFood` fetches those when one is picked.
 */
export function useFoodSearch(query: string) {
  const { userId } = useAuth();
  const q = query.trim();
  return useQuery({
    queryKey: qk.foodSearch(q.toLowerCase()),
    enabled: !!userId && q.length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await supabase.rpc('rpc_search_foods', { p_query: q, p_limit: 25 });
      if (error) throw error;
      return (data ?? []).map((row) => foodFromRow(row));
    },
  });
}

/** One food with its portions, for the amount picker. */
export function useFood(id: string | null | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.food(id ?? 'none'),
    enabled: !!userId && !!id,
    queryFn: async (): Promise<Food | null> => {
      const [food, portions] = await Promise.all([
        supabase.from('foods').select('*').eq('id', id!).maybeSingle(),
        supabase.from('food_portions').select('*').eq('food_id', id!).order('position'),
      ]);
      if (food.error) throw food.error;
      if (portions.error) throw portions.error;
      return food.data ? foodFromRow(food.data, portions.data ?? []) : null;
    },
  });
}

/** Your own saved copy of a barcode's product, if you have one. */
export async function ownFoodForBarcode(scanned: string): Promise<Food | null> {
  const code = canonicalBarcode(scanned);
  if (!code) return null;
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .not('owner_id', 'is', null)
    .eq('barcode', code)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? foodFromRow(data[0]) : null;
}
