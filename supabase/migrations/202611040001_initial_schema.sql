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
