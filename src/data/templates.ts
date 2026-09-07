import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { MuscleGroup, WorkoutTemplate } from '@/lib/database.types';
import type { PlannedSlot, TemplateDraftItem } from '@/domain/templates';
import { useAuth } from '@/providers/AuthProvider';

export interface TemplateItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  orderIndex: number;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
}

export interface TemplateWithItems extends WorkoutTemplate {
  items: TemplateItem[];
}

const TEMPLATE_SELECT =
  '*, template_exercises(id, exercise_id, order_index, target_sets, target_rep_low, target_rep_high, exercise:exercises(name, muscle_group))';

interface RawTemplateRow extends WorkoutTemplate {
  template_exercises: {
    id: string;
    exercise_id: string;
    order_index: number;
    target_sets: number;
    target_rep_low: number;
    target_rep_high: number;
    exercise: { name: string; muscle_group: MuscleGroup } | null;
  }[];
}

function toTemplate(row: RawTemplateRow): TemplateWithItems {
  const items = (row.template_exercises ?? [])
    .map((te) => ({
      id: te.id,
      exerciseId: te.exercise_id,
      exerciseName: te.exercise?.name ?? 'Exercise',
      muscleGroup: (te.exercise?.muscle_group ?? 'core') as MuscleGroup,
      orderIndex: te.order_index,
      targetSets: te.target_sets,
      targetRepLow: te.target_rep_low,
      targetRepHigh: te.target_rep_high,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return { ...row, items };
}

export function useTemplates() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.templates,
    enabled: !!userId,
    queryFn: async (): Promise<TemplateWithItems[]> => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select(TEMPLATE_SELECT)
        .order('name');
      if (error) throw error;
      return ((data ?? []) as unknown as RawTemplateRow[]).map(toTemplate);
    },
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: qk.template(id ?? 'none'),
    enabled: !!id,
    queryFn: async (): Promise<TemplateWithItems> => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select(TEMPLATE_SELECT)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return toTemplate(data as unknown as RawTemplateRow);
    },
  });
}

/** Create or replace a preset and its exercise list in one go. */
export function useSaveTemplate() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      templateId?: string;
      name: string;
      note?: string | null;
      items: TemplateDraftItem[];
    }): Promise<string> => {
      let templateId = input.templateId;

      if (templateId) {
        const { error } = await supabase
          .from('workout_templates')
          .update({ name: input.name, note: input.note ?? null, updated_at: new Date().toISOString() })
          .eq('id', templateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('workout_templates')
          .insert({ user_id: userId!, name: input.name, note: input.note ?? null })
          .select('id')
          .single();
        if (error) throw error;
        templateId = data.id;
      }

      // Replace contents wholesale — simpler and safe at this size.
      const del = await supabase.from('template_exercises').delete().eq('template_id', templateId);
      if (del.error) throw del.error;

      if (input.items.length > 0) {
        const rows = input.items.map((item, i) => ({
          template_id: templateId!,
          exercise_id: item.exerciseId,
          order_index: i,
          target_sets: item.targetSets,
          target_rep_low: item.targetRepLow,
          target_rep_high: item.targetRepHigh,
        }));
        const ins = await supabase.from('template_exercises').insert(rows);
        if (ins.error) throw ins.error;
      }

      return templateId!;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.templates });
    },
  });
}

/** Save the exercises of a performed workout as a named preset. */
export function useSaveWorkoutAsTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workoutId: string; name: string }): Promise<string> => {
      const { data, error } = await supabase.rpc('rpc_save_workout_as_template', {
        p_workout_id: input.workoutId,
        p_name: input.name,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.templates }),
  });
}

export function useDeleteTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.templates });
      client.invalidateQueries({ queryKey: qk.planned });
    },
  });
}

/** Start (or resume) a workout and populate it from a preset. */
export function useStartWorkoutFromTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('rpc_start_workout_from_template', {
        p_template_id: templateId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (workoutId) => {
      client.invalidateQueries({ queryKey: qk.workouts });
      client.invalidateQueries({ queryKey: qk.openWorkout });
      client.invalidateQueries({ queryKey: qk.workoutExercises(workoutId) });
    },
  });
}

// --- Slots on a live workout ------------------------------------------------

export function useWorkoutExercises(workoutId: string | undefined) {
  return useQuery({
    queryKey: qk.workoutExercises(workoutId ?? 'none'),
    enabled: !!workoutId,
    queryFn: async (): Promise<PlannedSlot[]> => {
      const { data, error } = await supabase
        .from('workout_exercises')
        .select('id, exercise_id, order_index, target_sets, target_rep_low, target_rep_high, suggested_weight, exercise:exercises(name)')
        .eq('workout_id', workoutId!)
        .order('order_index');
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string;
        exercise_id: string;
        order_index: number;
        target_sets: number;
        target_rep_low: number;
        target_rep_high: number;
        suggested_weight: number | null;
        exercise: { name: string } | null;
      }[]).map((r) => ({
        id: r.id,
        exerciseId: r.exercise_id,
        exerciseName: r.exercise?.name ?? 'Exercise',
        orderIndex: r.order_index,
        targetSets: r.target_sets,
        targetRepLow: r.target_rep_low,
        targetRepHigh: r.target_rep_high,
        suggestedWeight: r.suggested_weight,
      }));
    },
  });
}

export interface SlotInput {
  exerciseId: string;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  suggestedWeight?: number | null;
}

/** Write exercise slots onto a workout (used by the generator). */
export function useAddWorkoutExercises() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workoutId: string; slots: SlotInput[] }) => {
      if (input.slots.length === 0) return;
      const rows = input.slots.map((s, i) => ({
        user_id: userId!,
        workout_id: input.workoutId,
        exercise_id: s.exerciseId,
        order_index: i,
        target_sets: s.targetSets,
        target_rep_low: s.targetRepLow,
        target_rep_high: s.targetRepHigh,
        suggested_weight: s.suggestedWeight ?? null,
      }));
      // Ignore duplicates so re-running a plan onto the same session is safe.
      const { error } = await supabase
        .from('workout_exercises')
        .upsert(rows, { onConflict: 'workout_id,exercise_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, input) =>
      client.invalidateQueries({ queryKey: qk.workoutExercises(input.workoutId) }),
  });
}

export function useRemoveWorkoutExercise(workoutId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase.from('workout_exercises').delete().eq('id', slotId);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.workoutExercises(workoutId) }),
  });
}
