export type AbsenceReason = "sakit" | "izin" | "alfa";
export type AttendanceCheckRow = { student_id: string; is_missed: boolean; absence_reason?: AbsenceReason | null };

export function isMissedFromCheckbox(isChecked: boolean): boolean {
  return isChecked;
}

export function attendanceCheckedMap(students: { id: string }[], records: AttendanceCheckRow[], sessionSaved: boolean): Record<string, boolean> {
  const stored = new Map(records.map((record) => [record.student_id, record.is_missed]));
  return Object.fromEntries(students.map((student) => [student.id, sessionSaved ? stored.get(student.id) ?? false : false]));
}

export function attendanceReasonMap(students: { id: string }[], records: AttendanceCheckRow[]): Record<string, AbsenceReason> {
  const stored = new Map(records.map((record) => [record.student_id, record.absence_reason]));
  return Object.fromEntries(students.map((student) => [student.id, stored.get(student.id) ?? "alfa"]));
}
