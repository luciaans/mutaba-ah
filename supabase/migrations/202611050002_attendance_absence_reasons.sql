alter table public.prayer_attendance
  add column if not exists absence_reason text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'prayer_attendance_absence_reason_check'
      and conrelid = 'public.prayer_attendance'::regclass
  ) then
    alter table public.prayer_attendance
      add constraint prayer_attendance_absence_reason_check
      check (
        (is_missed and (absence_reason is null or absence_reason in ('sakit', 'izin', 'alfa')))
        or (not is_missed and absence_reason is null)
      );
  end if;
end;
$$;

alter table public.attendance_logs
  add column if not exists previous_absence_reason text,
  add column if not exists new_absence_reason text;

create or replace function public.log_prayer_attendance_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.attendance_logs (attendance_id, student_id, attendance_date, prayer_name, previous_status, new_status, previous_absence_reason, new_absence_reason, action, changed_by)
    values (new.id, new.student_id, new.attendance_date, new.prayer_name, null, new.is_missed, null, new.absence_reason, 'INSERT', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.attendance_logs (attendance_id, student_id, attendance_date, prayer_name, previous_status, new_status, previous_absence_reason, new_absence_reason, action, changed_by)
    values (new.id, new.student_id, new.attendance_date, new.prayer_name, old.is_missed, new.is_missed, old.absence_reason, new.absence_reason, 'UPDATE', auth.uid());
    return new;
  else
    insert into public.attendance_logs (attendance_id, student_id, attendance_date, prayer_name, previous_status, new_status, previous_absence_reason, new_absence_reason, action, changed_by)
    values (old.id, old.student_id, old.attendance_date, old.prayer_name, old.is_missed, null, old.absence_reason, null, 'DELETE', auth.uid());
    return old;
  end if;
end;
$$;

create or replace function public.save_attendance_session(
  p_class_id uuid,
  p_attendance_date date,
  p_prayer_name text,
  p_expected_updated_at timestamptz,
  p_records jsonb
)
returns table(session_id uuid, saved_updated_at timestamptz, saved_by uuid, saved_count integer)
language plpgsql
set search_path = ''
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_roster_count integer;
  v_record_count integer;
  v_invalid_count integer;
  v_saved_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sesi masuk diperlukan.' using errcode = '42501';
  end if;
  if not (select public.is_admin()) and not (select public.teacher_has_class(p_class_id)) then
    raise exception 'Akses kelas ditolak.' using errcode = '42501';
  end if;
  if p_attendance_date > (now() at time zone 'Asia/Pontianak')::date then
    raise exception 'Tanggal absensi tidak boleh di masa depan.' using errcode = '22007';
  end if;
  if not (select public.is_admin()) and p_attendance_date < (now() at time zone 'Asia/Pontianak')::date - 3 then
    raise exception 'Ustaz hanya dapat mengubah absensi maksimal 3 hari ke belakang.' using errcode = '42501';
  end if;
  if p_prayer_name not in ('subuh', 'zuhur', 'asar', 'magrib', 'isya') then
    raise exception 'Waktu salat tidak valid.' using errcode = '22023';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'Daftar santri tidak valid.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_class_id::text || ':' || p_attendance_date::text || ':' || p_prayer_name, 0
  ));

  select * into v_session
  from public.attendance_sessions s
  where s.class_id = p_class_id and s.attendance_date = p_attendance_date and s.prayer_name = p_prayer_name
  for update;
  if found then
    if p_expected_updated_at is null or p_expected_updated_at is distinct from v_session.updated_at then
      raise exception 'Sesi sudah diperbarui oleh pengguna lain. Muat ulang data sebelum menyimpan.' using errcode = '40001';
    end if;
  elsif p_expected_updated_at is not null then
    raise exception 'Sesi berubah sejak dibuka. Muat ulang data sebelum menyimpan.' using errcode = '40001';
  end if;

  select count(*) into v_roster_count
  from public.students s where s.class_id = p_class_id and s.is_active;
  select count(*) into v_record_count from jsonb_array_elements(p_records);
  if v_record_count <> v_roster_count then
    raise exception 'Daftar santri berubah. Muat ulang absensi sebelum menyimpan.' using errcode = '40001';
  end if;
  select count(*) into v_invalid_count
  from jsonb_to_recordset(p_records) as r(student_id uuid, is_missed boolean, absence_reason text)
  left join public.students s on s.id = r.student_id
  where r.student_id is null or r.is_missed is null or s.id is null
    or s.class_id <> p_class_id or not s.is_active
    or (r.is_missed and (r.absence_reason is null or r.absence_reason not in ('sakit', 'izin', 'alfa')))
    or (not r.is_missed and r.absence_reason is not null);
  if v_invalid_count > 0 or (
    select count(distinct r.student_id) from jsonb_to_recordset(p_records) as r(student_id uuid, is_missed boolean, absence_reason text)
  ) <> v_record_count then
    raise exception 'Daftar santri atau alasan tidak cocok dengan kelas yang dipilih.' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('mutabaah.atomic_attendance_save', 'true', true);

  insert into public.attendance_sessions (class_id, attendance_date, prayer_name, recorded_by)
  values (p_class_id, p_attendance_date, p_prayer_name, auth.uid())
  on conflict (class_id, attendance_date, prayer_name)
  do update set recorded_by = excluded.recorded_by
  returning * into v_session;

  insert into public.prayer_attendance (student_id, class_id, attendance_date, prayer_name, is_missed, absence_reason, recorded_by)
  select r.student_id, p_class_id, p_attendance_date, p_prayer_name, r.is_missed, r.absence_reason, auth.uid()
  from jsonb_to_recordset(p_records) as r(student_id uuid, is_missed boolean, absence_reason text)
  on conflict (student_id, attendance_date, prayer_name)
  do update set class_id = excluded.class_id, is_missed = excluded.is_missed,
    absence_reason = excluded.absence_reason, recorded_by = excluded.recorded_by;
  get diagnostics v_saved_count = row_count;

  return query select v_session.id, v_session.updated_at, v_session.recorded_by, v_saved_count;
end;
$$;

drop function if exists public.attendance_student_calendar(uuid, date, date);
create function public.attendance_student_calendar(p_student_id uuid, p_start_date date, p_end_date date)
returns table(attendance_date date, prayer_name text, is_missed boolean, absence_reason text, updated_at timestamptz, recorded_by uuid)
language sql stable security invoker
set search_path = ''
as $$
  select a.attendance_date, a.prayer_name, a.is_missed, a.absence_reason, a.updated_at, a.recorded_by
  from public.prayer_attendance a
  where a.student_id = p_student_id and a.attendance_date between p_start_date and p_end_date
  order by a.attendance_date, a.prayer_name;
$$;

revoke all on function public.attendance_student_calendar(uuid, date, date) from public, anon;
grant execute on function public.attendance_student_calendar(uuid, date, date) to authenticated;
