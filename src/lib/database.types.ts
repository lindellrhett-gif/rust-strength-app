/**
 * Hand-written to match supabase/migrations/0001_init.sql + 0002_milestone2.sql,
 * in the same shape the Supabase CLI emits (Row/Insert/Update/Relationships).
 *
 * Regenerate the real thing once the schema is applied:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type MG = Database['public']['Enums']['muscle_group'];
type EQ = Database['public']['Enums']['equipment_kind'];
type LT = Database['public']['Enums']['exercise_load_type'];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          username: string;
          display_name: string | null;
          unit: 'lb' | 'kg';
          target_rep_low: number;
          target_rep_high: number;
          body_weight: number | null;
          equipment: EQ[];
          created_at: string;
          terms_accepted_at: string | null;
          terms_version: string | null;
          age_confirmed_at: string | null;
          username_chosen: boolean;
          share_workouts: boolean;
          rest_seconds: number;
          rest_auto: boolean;
          level_seen: number;
        };
        Insert: {
          user_id: string;
          username: string;
          display_name?: string | null;
          unit?: 'lb' | 'kg';
          target_rep_low?: number;
          target_rep_high?: number;
          body_weight?: number | null;
          equipment?: EQ[];
          created_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          unit?: 'lb' | 'kg';
          target_rep_low?: number;
          target_rep_high?: number;
          body_weight?: number | null;
          equipment?: EQ[];
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          age_confirmed_at?: string | null;
          username_chosen?: boolean;
          share_workouts?: boolean;
          rest_seconds?: number;
          rest_auto?: boolean;
          level_seen?: number;
        };
        Relationships: [];
      };
      gyms: {
        Row: { id: string; user_id: string; name: string; created_at: string };
        Insert: { id?: string; user_id: string; name: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      machines: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string | null;
          label: string;
          increment: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id?: string | null;
          label: string;
          increment?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          gym_id?: string | null;
          label?: string;
          increment?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          muscle_group: MG;
          equipment: EQ | null;
          load_type: LT;
          is_custom: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          muscle_group: MG;
          equipment?: EQ | null;
          load_type?: LT;
          is_custom?: boolean;
          created_at?: string;
        };
        Update: { name?: string; muscle_group?: MG; equipment?: EQ | null; load_type?: LT };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          note: string | null;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at?: string;
          ended_at?: string | null;
          note?: string | null;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          started_at?: string;
          ended_at?: string | null;
          note?: string | null;
          name?: string | null;
        };
        Relationships: [];
      };
      sets: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          machine_id: string | null;
          weight: number;
          reps: number;
          rpe: number | null;
          is_warmup: boolean;
          is_bodyweight: boolean;
          assist_weight: number | null;
          added_weight: number | null;
          duration_seconds: number | null;
          target_rep_low: number;
          target_rep_high: number;
          e1rm: number;
          order_index: number;
          performed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          machine_id?: string | null;
          weight: number;
          reps: number;
          rpe?: number | null;
          is_warmup?: boolean;
          is_bodyweight?: boolean;
          assist_weight?: number | null;
          added_weight?: number | null;
          duration_seconds?: number | null;
          target_rep_low?: number;
          target_rep_high?: number;
          e1rm?: number;
          order_index?: number;
          performed_at?: string;
          created_at?: string;
        };
        Update: {
          machine_id?: string | null;
          weight?: number;
          reps?: number;
          rpe?: number | null;
          is_warmup?: boolean;
          is_bodyweight?: boolean;
          assist_weight?: number | null;
          added_weight?: number | null;
          duration_seconds?: number | null;
          e1rm?: number;
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sets_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sets_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sets_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      planned_sessions: {
        Row: {
          id: string;
          user_id: string;
          scheduled_for: string;
          title: string;
          note: string | null;
          completed_workout_id: string | null;
          template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scheduled_for: string;
          title?: string;
          note?: string | null;
          completed_workout_id?: string | null;
          template_id?: string | null;
          created_at?: string;
        };
        Update: {
          scheduled_for?: string;
          title?: string;
          note?: string | null;
          completed_workout_id?: string | null;
          template_id?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted';
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted';
          created_at?: string;
          responded_at?: string | null;
        };
        Update: { status?: 'pending' | 'accepted'; responded_at?: string | null };
        Relationships: [];
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: { name?: string; note?: string | null; updated_at?: string };
        Relationships: [];
      };
      template_exercises: {
        Row: {
          id: string;
          template_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_rep_low: number;
          target_rep_high: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          exercise_id: string;
          order_index?: number;
          target_sets?: number;
          target_rep_low?: number;
          target_rep_high?: number;
        };
        Update: {
          order_index?: number;
          target_sets?: number;
          target_rep_low?: number;
          target_rep_high?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'template_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_exercises: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_rep_low: number;
          target_rep_high: number;
          suggested_weight: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          order_index?: number;
          target_sets?: number;
          target_rep_low?: number;
          target_rep_high?: number;
          suggested_weight?: number | null;
          created_at?: string;
        };
        Update: {
          order_index?: number;
          target_sets?: number;
          target_rep_low?: number;
          target_rep_high?: number;
          suggested_weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      user_blocks: {
        Row: { id: string; blocker_id: string; blocked_id: string; created_at: string };
        Insert: { id?: string; blocker_id: string; blocked_id: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'user_blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      user_reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_id: string;
          reason: Database['public']['Enums']['report_reason'];
          details: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_id: string;
          reason?: Database['public']['Enums']['report_reason'];
          details?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: { status?: string; details?: string | null };
        Relationships: [];
      };
      run_preferences: {
        Row: {
          user_id: string;
          auto_pause: boolean;
          audio_cues: boolean;
          share_default: boolean;
          map_default: 'private' | 'friends';
          weekly_goal_m: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          auto_pause?: boolean;
          audio_cues?: boolean;
          share_default?: boolean;
          map_default?: 'private' | 'friends';
          weekly_goal_m?: number | null;
          updated_at?: string;
        };
        Update: {
          auto_pause?: boolean;
          audio_cues?: boolean;
          share_default?: boolean;
          map_default?: 'private' | 'friends';
          weekly_goal_m?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rest_days: {
        Row: {
          id: string;
          user_id: string;
          rest_date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rest_date: string;
          note?: string | null;
          created_at?: string;
        };
        Update: { rest_date?: string; note?: string | null };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          kind: Database['public']['Enums']['activity_kind'];
          name: string | null;
          performed_at: string;
          duration_seconds: number;
          distance: number | null;
          distance_unit: 'mi' | 'km' | 'm' | null;
          steps: number | null;
          calories: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind?: Database['public']['Enums']['activity_kind'];
          name?: string | null;
          performed_at?: string;
          duration_seconds: number;
          distance?: number | null;
          distance_unit?: 'mi' | 'km' | 'm' | null;
          steps?: number | null;
          calories?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          kind?: Database['public']['Enums']['activity_kind'];
          name?: string | null;
          performed_at?: string;
          duration_seconds?: number;
          distance?: number | null;
          distance_unit?: 'mi' | 'km' | 'm' | null;
          steps?: number | null;
          calories?: number | null;
          note?: string | null;
        };
        Relationships: [];
      };
      profile_badges: {
        Row: {
          user_id: string;
          badge_id: string;
          granted_at: string;
          note: string | null;
        };
        // Awarded by the service role only — there is no insert policy for
        // signed-in users, so the app never writes this table.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      feed_reactions: {
        Row: {
          id: string;
          subject_type: 'workout' | 'activity';
          subject_id: string;
          user_id: string;
          reaction: 'fire' | 'strong' | 'heavy' | 'respect';
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_type: 'workout' | 'activity';
          subject_id: string;
          user_id: string;
          reaction: 'fire' | 'strong' | 'heavy' | 'respect';
          created_at?: string;
        };
        Update: { reaction?: 'fire' | 'strong' | 'heavy' | 'respect' };
        Relationships: [];
      };
    };
    Views: {
      v_activity_totals: {
        Row: {
          user_id: string | null;
          total_seconds: number | null;
          total_activities: number | null;
          distinct_kinds: number | null;
        };
        Relationships: [];
      };
      v_exercise_prs: {
        Row: {
          user_id: string | null;
          exercise_id: string | null;
          exercise_name: string | null;
          muscle_group: MG | null;
          best_e1rm: number | null;
          best_weight: number | null;
          best_reps: number | null;
          best_set_volume: number | null;
        };
        Relationships: [];
      };
      v_all_time_totals: {
        Row: {
          user_id: string | null;
          volume: number | null;
          total_reps: number | null;
          total_sets: number | null;
          total_workouts: number | null;
          total_seconds: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      rpc_save_run: {
        Args: {
          p_id: string;
          p_performed_at: string;
          p_source: 'gps' | 'manual' | 'treadmill';
          p_distance_m: number;
          p_moving_seconds: number;
          p_elapsed_seconds: number;
          p_distance_unit: 'mi' | 'km';
          p_name?: string | null;
          p_note?: string | null;
          p_elevation_gain_m?: number | null;
          p_elevation_loss_m?: number | null;
          p_calories?: number | null;
          p_effort?: number | null;
          p_splits?: Json;
          p_polyline?: string | null;
          p_alts?: number[] | null;
          p_times?: number[] | null;
          p_best_efforts?: Json;
          p_map_visibility?: 'private' | 'friends';
        };
        Returns: string;
      };
      rpc_get_run: {
        Args: { p_activity_id: string };
        Returns: {
          id: string;
          name: string | null;
          note: string | null;
          performed_at: string;
          calories: number | null;
          distance_unit: 'mi' | 'km' | 'm' | null;
          source: 'gps' | 'manual' | 'treadmill';
          distance_m: number;
          moving_seconds: number;
          elapsed_seconds: number;
          elevation_gain_m: number | null;
          elevation_loss_m: number | null;
          effort: number | null;
          splits: Json;
          has_elevation: boolean;
          map_visibility: 'private' | 'friends';
          route_id: string | null;
          polyline: string | null;
          alts: number[] | null;
          times: number[] | null;
          best_efforts: Json;
        }[];
      };
      rpc_weekly_coverage: {
        Args: { week_start: string };
        Returns: { muscle_group: MG; set_count: number }[];
      };
      rpc_search_users: {
        Args: { q: string };
        Returns: { user_id: string; username: string; display_name: string | null }[];
      };
      rpc_friend_stats: {
        Args: { target: string; p_today?: string };
        Returns: {
          user_id: string;
          username: string;
          display_name: string | null;
          total_workouts: number;
          total_volume: number;
          total_reps: number;
          total_sets: number;
          total_seconds: number;
          workout_dates: string[];
          activity_seconds: number;
          activity_count: number;
          activity_kinds: number;
          friend_count: number;
          current_streak: number;
          best_streak: number;
          consistency_30: number;
        }[];
      };
      rpc_friend_leaderboard: {
        Args: { p_since?: string | null; p_today?: string };
        Returns: {
          user_id: string;
          username: string;
          display_name: string | null;
          unit: 'lb' | 'kg';
          is_me: boolean;
          total_volume: number;
          workout_seconds: number;
          activity_seconds: number;
          current_streak: number;
          consistency_30: number;
        }[];
      };
      are_friends: { Args: { a: string; b: string }; Returns: boolean };
      can_react_to: { Args: { p_type: string; p_id: string }; Returns: boolean };
      rpc_friend_feed: {
        Args: { p_limit?: number; p_before?: string | null };
        Returns: {
          subject_type: 'workout' | 'activity';
          subject_id: string;
          user_id: string;
          username: string;
          display_name: string | null;
          occurred_at: string;
          name: string | null;
          duration_seconds: number;
          volume: number;
          total_sets: number;
          total_reps: number;
          exercise_names: string[];
          record_count: number;
          activity_kind: string | null;
          distance: number | null;
          distance_unit: string | null;
          badge_ids: string[];
          // jsonb object keyed by reaction id, e.g. { fire: 3, strong: 1 }
          reaction_counts: Record<string, number>;
          my_reaction: string | null;
        }[];
      };
      rpc_block_user: { Args: { target: string }; Returns: undefined };
      rpc_export_my_data: { Args: Record<string, never>; Returns: Json };
      rpc_delete_my_account: { Args: Record<string, never>; Returns: undefined };
      rpc_friend_prs: {
        Args: { target: string };
        Returns: {
          exercise_name: string;
          best_weight: number;
          best_reps: number;
          best_e1rm: number;
        }[];
      };
      rpc_save_workout_as_template: {
        Args: { p_workout_id: string; p_name: string };
        Returns: string;
      };
      rpc_start_workout_from_template: {
        Args: { p_template_id: string };
        Returns: string;
      };
      rpc_workout_summary: {
        Args: { p_workout_id: string };
        Returns: {
          exercise_id: string;
          exercise_name: string;
          working_sets: number;
          volume: number;
          best_weight: number;
          best_reps: number;
          best_e1rm: number;
          prev_best_weight: number | null;
          prev_best_e1rm: number | null;
          is_weight_pr: boolean;
          is_e1rm_pr: boolean;
        }[];
      };
    };
    Enums: {
      muscle_group:
        | 'chest'
        | 'back'
        | 'shoulders'
        | 'biceps'
        | 'triceps'
        | 'quads'
        | 'hamstrings'
        | 'glutes'
        | 'calves'
        | 'core';
      weight_unit: 'lb' | 'kg';
      report_reason:
        | 'harassment'
        | 'impersonation'
        | 'inappropriate_name'
        | 'spam'
        | 'other';
      activity_kind:
        | 'run'
        | 'walk'
        | 'hike'
        | 'cycle'
        | 'swim'
        | 'row'
        | 'stairmaster'
        | 'elliptical'
        | 'jump_rope'
        | 'basketball'
        | 'soccer'
        | 'tennis'
        | 'boxing'
        | 'climbing'
        | 'yoga'
        | 'pickleball'
        | 'volleyball'
        | 'baseball'
        | 'softball'
        | 'football'
        | 'hockey'
        | 'golf'
        | 'badminton'
        | 'table_tennis'
        | 'racquetball'
        | 'squash'
        | 'lacrosse'
        | 'rugby'
        | 'ultimate_frisbee'
        | 'wrestling'
        | 'martial_arts'
        | 'skiing'
        | 'snowboarding'
        | 'skating'
        | 'skateboarding'
        | 'surfing'
        | 'kayaking'
        | 'paddleboarding'
        | 'spin'
        | 'hiit'
        | 'crossfit'
        | 'pilates'
        | 'dance'
        | 'stretching'
        | 'other';
      exercise_load_type: 'weighted' | 'bodyweight' | 'assisted' | 'timed';
      equipment_kind:
        | 'barbell'
        | 'dumbbell'
        | 'machine'
        | 'cable'
        | 'bodyweight'
        | 'kettlebell'
        | 'bands';
      friend_status: 'pending' | 'accepted';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// --- Convenience aliases used throughout the app ---------------------------

export type MuscleGroup = Database['public']['Enums']['muscle_group'];
export type WeightUnit = Database['public']['Enums']['weight_unit'];
export type EquipmentKind = Database['public']['Enums']['equipment_kind'];
export type FriendStatus = Database['public']['Enums']['friend_status'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Gym = Database['public']['Tables']['gyms']['Row'];
export type Machine = Database['public']['Tables']['machines']['Row'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type Workout = Database['public']['Tables']['workouts']['Row'];
export type SetRow = Database['public']['Tables']['sets']['Row'];
export type PlannedSession = Database['public']['Tables']['planned_sessions']['Row'];
export type WorkoutTemplate = Database['public']['Tables']['workout_templates']['Row'];
export type TemplateExercise = Database['public']['Tables']['template_exercises']['Row'];
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row'];
export type ActivityRow = Database['public']['Tables']['activities']['Row'];
export type RestDay = Database['public']['Tables']['rest_days']['Row'];
export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type ProfileBadge = Database['public']['Tables']['profile_badges']['Row'];
export type FeedReaction = Database['public']['Tables']['feed_reactions']['Row'];

export type ExercisePrRow = Database['public']['Views']['v_exercise_prs']['Row'];
export type AllTimeTotalsRow = Database['public']['Views']['v_all_time_totals']['Row'];
