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
