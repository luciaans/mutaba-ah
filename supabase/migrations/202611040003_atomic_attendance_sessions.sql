create or replace function public.teacher_can_view_profile(p_profile_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select public.is_admin()) or exists (
    select 1
    from public.teacher_classes own_class
    join public.teacher_classes shared_class on shared_class.class_id = own_class.class_id
    join public.profiles target on target.id = shared_class.teacher_id and target.role = 'ustaz' and target.is_active
    where own_class.teacher_id = (select auth.uid())
      and shared_class.teacher_id = p_profile_id
  );
$$;
revoke all on function public.teacher_can_view_profile(uuid) from public, anon;
grant execute on function public.teacher_can_view_profile(uuid) to authenticated;

drop policy profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_shared_class_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.teacher_can_view_profile(id)));

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
  from jsonb_to_recordset(p_records) as r(student_id uuid, is_missed boolean)
  left join public.students s on s.id = r.student_id
  where r.student_id is null or r.is_missed is null or s.id is null
    or s.class_id <> p_class_id or not s.is_active;
  if v_invalid_count > 0 or (
    select count(distinct r.student_id) from jsonb_to_recordset(p_records) as r(student_id uuid, is_missed boolean)
  ) <> v_record_count then
    raise exception 'Daftar santri tidak cocok dengan kelas yang dipilih.' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('mutabaah.atomic_attendance_save', 'true', true);

  insert into public.attendance_sessions (class_id, attendance_date, prayer_name, recorded_by)
  values (p_class_id, p_attendance_date, p_prayer_name, auth.uid())
  on conflict (class_id, attendance_date, prayer_name)
  do update set recorded_by = excluded.recorded_by
  returning * into v_session;

  insert into public.prayer_attendance (student_id, class_id, attendance_date, prayer_name, is_missed, recorded_by)
  select r.student_id, p_class_id, p_attendance_date, p_prayer_name, r.is_missed, auth.uid()
  from jsonb_to_recordset(p_records) as r(student_id uuid, is_missed boolean)
  on conflict (student_id, attendance_date, prayer_name)
  do update set class_id = excluded.class_id, is_missed = excluded.is_missed, recorded_by = excluded.recorded_by;
  get diagnostics v_saved_count = row_count;

  return query select v_session.id, v_session.updated_at, v_session.recorded_by, v_saved_count;
end;
$$;

revoke all on function public.save_attendance_session(uuid, date, text, timestamptz, jsonb) from public, anon;
grant execute on function public.save_attendance_session(uuid, date, text, timestamptz, jsonb) to authenticated;

create or replace function public.validate_prayer_attendance_link()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_student_class uuid;
begin
  select s.class_id into v_student_class from public.students s where s.id = new.student_id;
  if v_student_class is null or v_student_class <> new.class_id then
    raise exception 'Kelas absensi harus sesuai dengan kelas santri.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.attendance_sessions a
    where a.class_id = new.class_id and a.attendance_date = new.attendance_date and a.prayer_name = new.prayer_name
  ) then
    raise exception 'Simpan sesi absensi sebelum menyimpan catatan santri.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_prayer_attendance_link() from public, anon, authenticated;
create trigger prayer_attendance_validate_link
before insert or update on public.prayer_attendance
for each row execute function public.validate_prayer_attendance_link();
