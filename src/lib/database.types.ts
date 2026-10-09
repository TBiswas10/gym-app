// Generated from the Supabase project schema (generate_typescript_types). Regenerate after any migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      cardio_entries: {
        Row: { feel: string | null; id: string; kind: string; logged_at: string; logged_on: string; minutes: number; params: Json; source: string; user_id: string; workout_id: string | null };
        Insert: { feel?: string | null; id?: string; kind: string; logged_at?: string; logged_on: string; minutes: number; params?: Json; source?: string; user_id?: string; workout_id?: string | null };
        Update: { feel?: string | null; id?: string; kind?: string; logged_at?: string; logged_on?: string; minutes?: number; params?: Json; source?: string; user_id?: string; workout_id?: string | null };
        Relationships: [{ foreignKeyName: "cardio_entries_workout_id_user_id_fkey"; columns: ["workout_id", "user_id"]; isOneToOne: false; referencedRelation: "workouts"; referencedColumns: ["id", "user_id"] }];
      };
      checkins: {
        Row: { bodyweight_kg: number | null; checked_on: string; created_at: string; energy: number | null; id: string; notes: string | null; soreness: number | null; user_id: string; workout_id: string | null };
        Insert: { bodyweight_kg?: number | null; checked_on: string; created_at?: string; energy?: number | null; id?: string; notes?: string | null; soreness?: number | null; user_id?: string; workout_id?: string | null };
        Update: { bodyweight_kg?: number | null; checked_on?: string; created_at?: string; energy?: number | null; id?: string; notes?: string | null; soreness?: number | null; user_id?: string; workout_id?: string | null };
        Relationships: [{ foreignKeyName: "checkins_workout_id_user_id_fkey"; columns: ["workout_id", "user_id"]; isOneToOne: false; referencedRelation: "workouts"; referencedColumns: ["id", "user_id"] }];
      };
      exercises: {
        Row: { backup_name: string | null; category: string; cues: string[]; default_increment_kg: number; default_notes: string; kind: string; kit: string; mistakes: string[]; muscle_group: string; muscles: string[]; name: string; rep_hi: number; rep_lo: number; setup: string[]; slug: string; sort_order: number; weight_step_kg: number };
        Insert: { backup_name?: string | null; category: string; cues?: string[]; default_increment_kg: number; default_notes?: string; kind: string; kit: string; mistakes?: string[]; muscle_group: string; muscles: string[]; name: string; rep_hi: number; rep_lo: number; setup?: string[]; slug: string; sort_order: number; weight_step_kg: number };
        Update: { backup_name?: string | null; category?: string; cues?: string[]; default_increment_kg?: number; default_notes?: string; kind?: string; kit?: string; mistakes?: string[]; muscle_group?: string; muscles?: string[]; name?: string; rep_hi?: number; rep_lo?: number; setup?: string[]; slug?: string; sort_order?: number; weight_step_kg?: number };
        Relationships: [];
      };
      mcp_requests: {
        Row: { client_id: string | null; created_at: string; id: number; method: string; ms: number; ok: boolean; status: number; tool: string | null; user_id: string };
        Insert: { client_id?: string | null; created_at?: string; id?: number; method: string; ms: number; ok: boolean; status: number; tool?: string | null; user_id?: string };
        Update: { client_id?: string | null; created_at?: string; id?: number; method?: string; ms?: number; ok?: boolean; status?: number; tool?: string | null; user_id?: string };
        Relationships: [];
      };
      program_state: {
        Row: { created_at: string; deload_weeks: number[]; plan_type: string; rest_alerts: boolean; start_date: string; track_bodyweight: boolean; updated_at: string; user_id: string };
        Insert: { created_at?: string; deload_weeks?: number[]; plan_type: string; rest_alerts?: boolean; start_date: string; track_bodyweight?: boolean; updated_at?: string; user_id?: string };
        Update: { created_at?: string; deload_weeks?: number[]; plan_type?: string; rest_alerts?: boolean; start_date?: string; track_bodyweight?: boolean; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      program_templates: {
        Row: { created_at: string; id: string; name: string; plan_type: string; user_id: string | null };
        Insert: { created_at?: string; id?: string; name: string; plan_type: string; user_id?: string | null };
        Update: { created_at?: string; id?: string; name?: string; plan_type?: string; user_id?: string | null };
        Relationships: [];
      };
      reviews: {
        Row: { applied_at: string | null; chosen: string | null; created_at: string; id: string; recommendation: string; summary: Json; user_id: string; week: number };
        Insert: { applied_at?: string | null; chosen?: string | null; created_at?: string; id?: string; recommendation: string; summary?: Json; user_id?: string; week: number };
        Update: { applied_at?: string | null; chosen?: string | null; created_at?: string; id?: string; recommendation?: string; summary?: Json; user_id?: string; week?: number };
        Relationships: [];
      };
      schedule_overrides: {
        Row: { action: string; created_at: string; id: string; moved_to_date: string | null; planned_date: string; user_id: string };
        Insert: { action: string; created_at?: string; id?: string; moved_to_date?: string | null; planned_date: string; user_id?: string };
        Update: { action?: string; created_at?: string; id?: string; moved_to_date?: string | null; planned_date?: string; user_id?: string };
        Relationships: [];
      };
      sets: {
        Row: { exercise_slug: string; id: string; logged_at: string; position: number; reps: number | null; seconds: number | null; set_number: number; source: string; user_id: string; variant: string | null; weight_kg: number | null; workout_id: string };
        Insert: { exercise_slug: string; id?: string; logged_at?: string; position?: number; reps?: number | null; seconds?: number | null; set_number: number; source?: string; user_id?: string; variant?: string | null; weight_kg?: number | null; workout_id: string };
        Update: { exercise_slug?: string; id?: string; logged_at?: string; position?: number; reps?: number | null; seconds?: number | null; set_number?: number; source?: string; user_id?: string; variant?: string | null; weight_kg?: number | null; workout_id?: string };
        Relationships: [
          { foreignKeyName: "sets_exercise_slug_fkey"; columns: ["exercise_slug"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["slug"] },
          { foreignKeyName: "sets_workout_id_user_id_fkey"; columns: ["workout_id", "user_id"]; isOneToOne: false; referencedRelation: "workouts"; referencedColumns: ["id", "user_id"] },
        ];
      };
      template_days: {
        Row: { cardio_label: string; cardio_minutes: number; cardio_name: string; full_name: string; is_light: boolean; short_name: string; template_id: string; weekday: number };
        Insert: { cardio_label: string; cardio_minutes: number; cardio_name: string; full_name: string; is_light?: boolean; short_name: string; template_id: string; weekday: number };
        Update: { cardio_label?: string; cardio_minutes?: number; cardio_name?: string; full_name?: string; is_light?: boolean; short_name?: string; template_id?: string; weekday?: number };
        Relationships: [{ foreignKeyName: "template_days_template_id_fkey"; columns: ["template_id"]; isOneToOne: false; referencedRelation: "program_templates"; referencedColumns: ["id"] }];
      };
      template_exercises: {
        Row: { exercise_slug: string; position: number; rep_hi: number; rep_lo: number; sets: number; template_id: string; weekday: number };
        Insert: { exercise_slug: string; position: number; rep_hi: number; rep_lo: number; sets?: number; template_id: string; weekday: number };
        Update: { exercise_slug?: string; position?: number; rep_hi?: number; rep_lo?: number; sets?: number; template_id?: string; weekday?: number };
        Relationships: [
          { foreignKeyName: "template_exercises_exercise_slug_fkey"; columns: ["exercise_slug"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["slug"] },
          { foreignKeyName: "template_exercises_template_id_weekday_fkey"; columns: ["template_id", "weekday"]; isOneToOne: false; referencedRelation: "template_days"; referencedColumns: ["template_id", "weekday"] },
        ];
      };
      user_exercise_settings: {
        Row: { exercise_slug: string; increment_kg: number | null; notes: string | null; start_weight_kg: number | null; user_id: string };
        Insert: { exercise_slug: string; increment_kg?: number | null; notes?: string | null; start_weight_kg?: number | null; user_id?: string };
        Update: { exercise_slug?: string; increment_kg?: number | null; notes?: string | null; start_weight_kg?: number | null; user_id?: string };
        Relationships: [{ foreignKeyName: "user_exercise_settings_exercise_slug_fkey"; columns: ["exercise_slug"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["slug"] }];
      };
      workouts: {
        Row: { created_at: string; day_name: string; ended_at: string | null; id: string; is_light: boolean; notes: string | null; plan_type: string; planned_date: string; skipped_exercises: string[]; started_at: string; status: string; user_id: string; week: number; weekday: number };
        Insert: { created_at?: string; day_name: string; ended_at?: string | null; id?: string; is_light?: boolean; notes?: string | null; plan_type: string; planned_date: string; skipped_exercises?: string[]; started_at?: string; status?: string; user_id?: string; week: number; weekday: number };
        Update: { created_at?: string; day_name?: string; ended_at?: string | null; id?: string; is_light?: boolean; notes?: string | null; plan_type?: string; planned_date?: string; skipped_exercises?: string[]; started_at?: string; status?: string; user_id?: string; week?: number; weekday?: number };
        Relationships: [];
      };
    };
    Views: {
      program_state_view: {
        Row: { created_at: string | null; current_week: number | null; deload_weeks: number[] | null; plan_type: string | null; programme_complete: boolean | null; rest_alerts: boolean | null; start_date: string | null; track_bodyweight: boolean | null; updated_at: string | null; user_id: string | null };
        Relationships: [];
      };
    };
    Functions: {
      clone_template: { Args: { p_plan_type: string }; Returns: string };
      delete_my_account: { Args: never; Returns: undefined };
      replace_day_exercises: { Args: { p_template: string; p_weekday: number; p_rows: Json }; Returns: undefined };
      start_program: { Args: { p_plan_type: string; p_start_date: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
