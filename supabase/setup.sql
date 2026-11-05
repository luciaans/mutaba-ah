-- MUTABA'AH one-time setup for a brand-new Supabase project.
-- Review the project ref before running. Do not run this bundle twice.
-- This bundle applies schema, policies, triggers, RPCs, private photo storage,
-- reporting functions and write guards.

BEGIN;


-- ===== BEGIN 202611040001_initial_schema.sql =====
-- MUTABA'AH core schema. Apply with Supabase CLI after `supabase link`.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role text not null check (role in ('admin', 'ustaz')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null unique check (length(trim(class_name)) between 1 and 80),
  description text,
  academic_year text not null,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text unique,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  photo_url text,
  class_id uuid not null references public.classes (id) on delete restrict,
  roll_number integer not null check (roll_number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint students_class_roll_unique unique (class_id, roll_number)
);
create index students_class_active_roll_idx on public.students (class_id, is_active, roll_number);

create table public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint teacher_classes_teacher_class_unique unique (teacher_id, class_id)
);
create index teacher_classes_class_idx on public.teacher_classes (class_id, teacher_id);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  attendance_date date not null,
  prayer_name text not null check (prayer_name in ('subuh', 'zuhur', 'asar', 'magrib', 'isya')),
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_class_date_prayer_unique unique (class_id, attendance_date, prayer_name)
);
create index attendance_sessions_date_idx on public.attendance_sessions (attendance_date, class_id);

create table public.prayer_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  attendance_date date not null,
  prayer_name text not null check (prayer_name in ('subuh', 'zuhur', 'asar', 'magrib', 'isya')),
  is_missed boolean not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prayer_attendance_student_date_prayer_unique unique (student_id, attendance_date, prayer_name)
);
create index prayer_attendance_class_date_prayer_idx on public.prayer_attendance (class_id, attendance_date, prayer_name);
create index prayer_attendance_student_date_idx on public.prayer_attendance (student_id, attendance_date);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null,
  student_id uuid not null,
  attendance_date date not null,
  prayer_name text not null check (prayer_name in ('subuh', 'zuhur', 'asar', 'magrib', 'isya')),
  previous_status boolean,
  new_status boolean,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index attendance_logs_date_idx on public.attendance_logs (attendance_date desc, changed_at desc);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  );
$$;

create or replace function public.teacher_has_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_classes tc
    join public.profiles p on p.id = tc.teacher_id
    where tc.teacher_id = (select auth.uid())
      and tc.class_id = p_class_id
      and p.role = 'ustaz'
      and p.is_active
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.teacher_has_class(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.teacher_has_class(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger attendance_sessions_set_updated_at
before update on public.attendance_sessions
for each row execute function public.set_updated_at();
create trigger prayer_attendance_set_updated_at
before update on public.prayer_attendance
for each row execute function public.set_updated_at();

create or replace function public.reject_future_attendance_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.attendance_date > (now() at time zone 'Asia/Pontianak')::date then
    raise exception 'Tanggal absensi tidak boleh di masa depan' using errcode = '22007';
  end if;
  return new;
end;
$$;
create trigger prayer_attendance_reject_future_date
before insert or update of attendance_date on public.prayer_attendance
for each row execute function public.reject_future_attendance_date();
create trigger attendance_sessions_reject_future_date
before insert or update of attendance_date on public.attendance_sessions
for each row execute function public.reject_future_attendance_date();

create or replace function public.log_prayer_attendance_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.attendance_logs (attendance_id, student_id, attendance_date, prayer_name, previous_status, new_status, action, changed_by)
    values (new.id, new.student_id, new.attendance_date, new.prayer_name, null, new.is_missed, 'INSERT', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.attendance_logs (attendance_id, student_id, attendance_date, prayer_name, previous_status, new_status, action, changed_by)
    values (new.id, new.student_id, new.attendance_date, new.prayer_name, old.is_missed, new.is_missed, 'UPDATE', auth.uid());
    return new;
  else
    insert into public.attendance_logs (attendance_id, student_id, attendance_date, prayer_name, previous_status, new_status, action, changed_by)
    values (old.id, old.student_id, old.attendance_date, old.prayer_name, old.is_missed, null, 'DELETE', auth.uid());
    return old;
  end if;
end;
$$;
revoke all on function public.log_prayer_attendance_change() from public, anon, authenticated;
create trigger prayer_attendance_audit
after insert or update or delete on public.prayer_attendance
for each row execute function public.log_prayer_attendance_change();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.prayer_attendance enable row level security;
alter table public.attendance_logs enable row level security;

create policy profiles_select_self_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_insert on public.profiles for insert to authenticated
with check ((select public.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_admin_delete on public.profiles for delete to authenticated
using ((select public.is_admin()));

create policy classes_select_assigned on public.classes for select to authenticated
using ((select public.is_admin()) or (select public.teacher_has_class(id)));
create policy classes_admin_all on public.classes for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy students_select_assigned on public.students for select to authenticated
using ((select public.is_admin()) or (select public.teacher_has_class(class_id)));
create policy students_admin_insert on public.students for insert to authenticated
with check ((select public.is_admin()));
create policy students_admin_update on public.students for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy students_admin_delete on public.students for delete to authenticated
using ((select public.is_admin()));

create policy teacher_classes_select_self_or_admin on public.teacher_classes for select to authenticated
using (teacher_id = (select auth.uid()) or (select public.is_admin()));
create policy teacher_classes_admin_all on public.teacher_classes for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy attendance_sessions_select_assigned on public.attendance_sessions for select to authenticated
using ((select public.is_admin()) or (select public.teacher_has_class(class_id)));
create policy attendance_sessions_insert_assigned on public.attendance_sessions for insert to authenticated
with check (((select public.is_admin()) or (select public.teacher_has_class(class_id))) and recorded_by = (select auth.uid()));
create policy attendance_sessions_update_assigned on public.attendance_sessions for update to authenticated
using ((select public.is_admin()) or (select public.teacher_has_class(class_id)))
with check (((select public.is_admin()) or (select public.teacher_has_class(class_id))) and recorded_by = (select auth.uid()));
create policy attendance_sessions_delete_admin on public.attendance_sessions for delete to authenticated
using ((select public.is_admin()));

create policy prayer_attendance_select_assigned on public.prayer_attendance for select to authenticated
using ((select public.is_admin()) or (select public.teacher_has_class(class_id)));
create policy prayer_attendance_insert_assigned on public.prayer_attendance for insert to authenticated
with check (((select public.is_admin()) or (select public.teacher_has_class(class_id))) and recorded_by = (select auth.uid()));
create policy prayer_attendance_update_assigned on public.prayer_attendance for update to authenticated
using ((select public.is_admin()) or (select public.teacher_has_class(class_id)))
with check (((select public.is_admin()) or (select public.teacher_has_class(class_id))) and recorded_by = (select auth.uid()));
create policy prayer_attendance_delete_admin on public.prayer_attendance for delete to authenticated
using ((select public.is_admin()));

create policy attendance_logs_admin_select on public.attendance_logs for select to authenticated
using ((select public.is_admin()));

grant select, insert, update, delete on public.profiles, public.classes, public.students, public.teacher_classes, public.attendance_sessions, public.prayer_attendance to authenticated;
grant select on public.attendance_logs to authenticated;
revoke all on all tables in schema public from anon;
revoke all on public.attendance_logs from authenticated;
grant select on public.attendance_logs to authenticated;

-- ===== END 202611040001_initial_schema.sql =====


-- ===== BEGIN 202611040002_private_student_photos.sql =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

create policy student_photos_read_assigned on storage.objects for select to authenticated
using (
  bucket_id = 'student-photos'
  and (select public.is_admin() or public.teacher_has_class((storage.foldername(name))[1]::uuid))
);
create policy student_photos_insert_assigned on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-photos'
  and (select public.is_admin() or public.teacher_has_class((storage.foldername(name))[1]::uuid))
);
create policy student_photos_update_assigned on storage.objects for update to authenticated
using (
  bucket_id = 'student-photos'
  and (select public.is_admin() or public.teacher_has_class((storage.foldername(name))[1]::uuid))
)
with check (
  bucket_id = 'student-photos'
  and (select public.is_admin() or public.teacher_has_class((storage.foldername(name))[1]::uuid))
);
create policy student_photos_delete_admin on storage.objects for delete to authenticated
using (bucket_id = 'student-photos' and (select public.is_admin()));

-- ===== END 202611040002_private_student_photos.sql =====


-- ===== BEGIN 202611040003_atomic_attendance_sessions.sql =====
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

-- ===== END 202611040003_atomic_attendance_sessions.sql =====


-- ===== BEGIN 202611040004_reporting_aggregates.sql =====
alter table public.prayer_attendance
  add constraint prayer_attendance_session_fk
  foreign key (class_id, attendance_date, prayer_name)
  references public.attendance_sessions (class_id, attendance_date, prayer_name)
  on delete restrict on update restrict;

create or replace function public.dashboard_summary(p_attendance_date date)
returns table(
  active_student_count bigint,
  class_count bigint,
  responsibility_class_count bigint,
  recorded_student_count bigint,
  missed_student_count bigint,
  prayer_name text,
  session_saved boolean,
  performed_count bigint,
  missed_count bigint,
  attendance_count bigint,
  success_percent numeric
)
language sql stable security invoker
set search_path = ''
as $$
  with accessible_classes as (
    select c.id from public.classes c
  ),
  prayers(prayer_name, prayer_order) as (
    values ('subuh', 1), ('zuhur', 2), ('asar', 3), ('magrib', 4), ('isya', 5)
  ),
  global_counts as (
    select
      (select count(*) from public.students s join accessible_classes c on c.id = s.class_id where s.is_active) as active_student_count,
      (select count(*) from accessible_classes) as class_count,
      case when (select public.is_admin()) then (select count(*) from accessible_classes)
        else (select count(*) from public.teacher_classes tc where tc.teacher_id = (select auth.uid())) end as responsibility_class_count,
      (select count(distinct a.student_id) from public.prayer_attendance a join accessible_classes c on c.id = a.class_id where a.attendance_date = p_attendance_date) as recorded_student_count,
      (select count(distinct a.student_id) from public.prayer_attendance a join accessible_classes c on c.id = a.class_id where a.attendance_date = p_attendance_date and a.is_missed) as missed_student_count
  ),
  prayer_counts as (
    select p.prayer_name, p.prayer_order,
      exists(select 1 from public.attendance_sessions s join accessible_classes c on c.id = s.class_id where s.attendance_date = p_attendance_date and s.prayer_name = p.prayer_name) as session_saved,
      count(a.id) filter (where c.id is not null and not a.is_missed) as performed_count,
      count(a.id) filter (where c.id is not null and a.is_missed) as missed_count,
      count(a.id) filter (where c.id is not null) as attendance_count
    from prayers p
    left join public.prayer_attendance a on a.prayer_name = p.prayer_name and a.attendance_date = p_attendance_date
    left join accessible_classes c on c.id = a.class_id
    group by p.prayer_name, p.prayer_order
  )
  select g.active_student_count, g.class_count, g.responsibility_class_count,
    g.recorded_student_count, g.missed_student_count, p.prayer_name, p.session_saved,
    p.performed_count, p.missed_count, p.attendance_count,
    case when p.attendance_count = 0 then null else round(p.performed_count::numeric * 100 / p.attendance_count, 1) end
  from global_counts g cross join prayer_counts p order by p.prayer_order;
$$;

create or replace function public.dashboard_recent_activities(p_limit integer default 8)
returns table(
  session_id uuid,
  class_id uuid,
  class_name text,
  attendance_date date,
  prayer_name text,
  updated_at timestamptz,
  recorded_by uuid,
  recorder_name text,
  student_count bigint,
  missed_count bigint
)
language sql stable security invoker
set search_path = ''
as $$
  select s.id, c.id, c.class_name, s.attendance_date, s.prayer_name, s.updated_at, p.id, p.full_name,
    count(a.id), count(a.id) filter (where a.is_missed)
  from public.attendance_sessions s
  join public.classes c on c.id = s.class_id
  join public.profiles p on p.id = s.recorded_by
  left join public.prayer_attendance a on a.class_id = s.class_id and a.attendance_date = s.attendance_date and a.prayer_name = s.prayer_name
  group by s.id, c.id, c.class_name, s.attendance_date, s.prayer_name, s.updated_at, p.id, p.full_name
  order by s.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;

create or replace function public.dashboard_class_reminders(p_attendance_date date)
returns table(class_id uuid, class_name text, prayer_name text, active_student_count bigint, recorded_student_count bigint)
language sql stable security invoker
set search_path = ''
as $$
  with prayers(prayer_name) as (
    values ('subuh'), ('zuhur'), ('asar'), ('magrib'), ('isya')
  )
  select c.id, c.class_name, p.prayer_name,
    (select count(*) from public.students st where st.class_id = c.id and st.is_active),
    (select count(distinct a.student_id) from public.prayer_attendance a
      where a.class_id = c.id and a.attendance_date = p_attendance_date and a.prayer_name = p.prayer_name)
  from public.classes c cross join prayers p
  where not exists (
    select 1 from public.attendance_sessions s
    where s.class_id = c.id and s.attendance_date = p_attendance_date and s.prayer_name = p.prayer_name
  ) or exists (
    select 1 from public.attendance_sessions s
    where s.class_id = c.id and s.attendance_date = p_attendance_date and s.prayer_name = p.prayer_name
      and (select count(distinct a.student_id) from public.prayer_attendance a
        where a.class_id = c.id and a.attendance_date = p_attendance_date and a.prayer_name = p.prayer_name)
        < (select count(*) from public.students st where st.class_id = c.id and st.is_active)
  )
  order by c.class_name, array_position(array['subuh', 'zuhur', 'asar', 'magrib', 'isya'], p.prayer_name);
$$;

create or replace function public.attendance_student_summary(p_start_date date, p_end_date date, p_class_id uuid default null)
returns table(
  student_id uuid,
  class_id uuid,
  class_name text,
  roll_number integer,
  full_name text,
  is_active boolean,
  total_count bigint,
  performed_count bigint,
  missed_count bigint,
  subuh_missed bigint,
  zuhur_missed bigint,
  asar_missed bigint,
  magrib_missed bigint,
  isya_missed bigint,
  success_percent numeric
)
language sql stable security invoker
set search_path = ''
as $$
  select st.id, c.id, c.class_name, st.roll_number, st.full_name, st.is_active,
    count(a.id), count(a.id) filter (where not a.is_missed), count(a.id) filter (where a.is_missed),
    count(a.id) filter (where a.is_missed and a.prayer_name = 'subuh'),
    count(a.id) filter (where a.is_missed and a.prayer_name = 'zuhur'),
    count(a.id) filter (where a.is_missed and a.prayer_name = 'asar'),
    count(a.id) filter (where a.is_missed and a.prayer_name = 'magrib'),
    count(a.id) filter (where a.is_missed and a.prayer_name = 'isya'),
    case when count(a.id) = 0 then null else round(count(a.id) filter (where not a.is_missed)::numeric * 100 / count(a.id), 1) end
  from public.students st
  join public.classes c on c.id = st.class_id
  left join public.prayer_attendance a on a.student_id = st.id and a.attendance_date between p_start_date and p_end_date
  where p_start_date <= p_end_date and (p_class_id is null or st.class_id = p_class_id)
  group by st.id, c.id, c.class_name, st.roll_number, st.full_name, st.is_active
  order by c.class_name, st.roll_number;
$$;

create or replace function public.attendance_student_calendar(p_student_id uuid, p_start_date date, p_end_date date)
returns table(attendance_date date, prayer_name text, is_missed boolean, updated_at timestamptz, recorded_by uuid)
language sql stable security invoker
set search_path = ''
as $$
  select a.attendance_date, a.prayer_name, a.is_missed, a.updated_at, a.recorded_by
  from public.prayer_attendance a
  where a.student_id = p_student_id and a.attendance_date between p_start_date and p_end_date
  order by a.attendance_date, a.prayer_name;
$$;

revoke all on function public.dashboard_summary(date) from public, anon;
revoke all on function public.dashboard_recent_activities(integer) from public, anon;
revoke all on function public.dashboard_class_reminders(date) from public, anon;
revoke all on function public.attendance_student_summary(date, date, uuid) from public, anon;
revoke all on function public.attendance_student_calendar(uuid, date, date) from public, anon;
grant execute on function public.dashboard_summary(date) to authenticated;
grant execute on function public.dashboard_recent_activities(integer) to authenticated;
grant execute on function public.dashboard_class_reminders(date) to authenticated;
grant execute on function public.attendance_student_summary(date, date, uuid) to authenticated;
grant execute on function public.attendance_student_calendar(uuid, date, date) to authenticated;

-- ===== END 202611040004_reporting_aggregates.sql =====


-- ===== BEGIN 202611040005_atomic_write_guard.sql =====
create or replace function public.require_atomic_attendance_save()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('mutabaah.atomic_attendance_save', true) is distinct from 'true' then
    raise exception 'Catatan absensi hanya dapat disimpan melalui prosedur sesi atomik.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.require_atomic_attendance_save() from public, anon, authenticated;

create trigger attendance_sessions_require_atomic_save
before insert or update on public.attendance_sessions
for each row execute function public.require_atomic_attendance_save();
create trigger prayer_attendance_require_atomic_save
before insert or update on public.prayer_attendance
for each row execute function public.require_atomic_attendance_save();

-- ===== END 202611040005_atomic_write_guard.sql =====


-- ===== BEGIN 202611050001_teacher_student_insert.sql =====
drop policy if exists students_admin_insert on public.students;

create policy students_insert_assigned on public.students for insert to authenticated
with check ((select public.is_admin()) or (select public.teacher_has_class(class_id)));

-- ===== END 202611050001_teacher_student_insert.sql =====


-- ===== BEGIN 202611050002_attendance_absence_reasons.sql =====
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

-- ===== END 202611050002_attendance_absence_reasons.sql =====

COMMIT;
