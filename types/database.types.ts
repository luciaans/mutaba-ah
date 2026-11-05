export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<{ id: string; username: string; full_name: string; role: "admin" | "ustaz"; is_active: boolean; created_at: string }>;
      classes: Table<{ id: string; class_name: string; description: string | null; academic_year: string; created_at: string }>;
      students: Table<{ id: string; student_number: string | null; full_name: string; photo_url: string | null; class_id: string; roll_number: number; is_active: boolean; created_at: string }>;
      teacher_classes: Table<{ id: string; teacher_id: string; class_id: string; created_at: string }>;
      attendance_sessions: Table<{ id: string; class_id: string; attendance_date: string; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; recorded_by: string; created_at: string; updated_at: string }>;
      prayer_attendance: Table<{ id: string; student_id: string; class_id: string; attendance_date: string; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; is_missed: boolean; absence_reason: "sakit" | "izin" | "alfa" | null; recorded_by: string; created_at: string; updated_at: string }>;
      attendance_logs: Table<{ id: string; attendance_id: string; student_id: string; attendance_date: string; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; previous_status: boolean | null; new_status: boolean | null; previous_absence_reason: "sakit" | "izin" | "alfa" | null; new_absence_reason: "sakit" | "izin" | "alfa" | null; action: "INSERT" | "UPDATE" | "DELETE"; changed_by: string | null; changed_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      teacher_has_class: { Args: { p_class_id: string }; Returns: boolean };
      teacher_can_view_profile: { Args: { p_profile_id: string }; Returns: boolean };
      save_attendance_session: {
        Args: { p_class_id: string; p_attendance_date: string; p_prayer_name: string; p_expected_updated_at: string | null; p_records: Json };
        Returns: { session_id: string; saved_updated_at: string; saved_by: string; saved_count: number }[];
      };
      dashboard_summary: { Args: { p_attendance_date: string }; Returns: { active_student_count: number; class_count: number; responsibility_class_count: number; recorded_student_count: number; missed_student_count: number; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; session_saved: boolean; performed_count: number; missed_count: number; attendance_count: number; success_percent: number | null }[] };
      dashboard_recent_activities: { Args: { p_limit?: number }; Returns: { session_id: string; class_id: string; class_name: string; attendance_date: string; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; updated_at: string; recorded_by: string; recorder_name: string; student_count: number; missed_count: number }[] };
      dashboard_class_reminders: { Args: { p_attendance_date: string }; Returns: { class_id: string; class_name: string; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; active_student_count: number; recorded_student_count: number }[] };
      attendance_student_summary: { Args: { p_start_date: string; p_end_date: string; p_class_id?: string | null }; Returns: { student_id: string; class_id: string; class_name: string; roll_number: number; full_name: string; is_active: boolean; total_count: number; performed_count: number; missed_count: number; subuh_missed: number; zuhur_missed: number; asar_missed: number; magrib_missed: number; isya_missed: number; success_percent: number | null }[] };
      attendance_student_calendar: { Args: { p_student_id: string; p_start_date: string; p_end_date: string }; Returns: { attendance_date: string; prayer_name: "subuh" | "zuhur" | "asar" | "magrib" | "isya"; is_missed: boolean; absence_reason: "sakit" | "izin" | "alfa" | null; updated_at: string; recorded_by: string }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
