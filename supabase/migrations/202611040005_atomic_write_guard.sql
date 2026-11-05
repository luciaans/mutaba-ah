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
