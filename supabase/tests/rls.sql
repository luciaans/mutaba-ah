-- Jalankan dengan `supabase test db` setelah migration dan seed tersedia.
-- Semua data fixture dibungkus transaksi dan dibatalkan di akhir.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@mutabaah.test', '', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@mutabaah.test', '', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, full_name, role)
values
  ('a1000000-0000-4000-8000-000000000001', 'rls-a', 'Ustaz Uji A', 'ustaz'),
  ('b1000000-0000-4000-8000-000000000002', 'rls-b', 'Ustaz Uji B', 'ustaz')
on conflict (id) do nothing;

insert into public.classes (id, class_name, academic_year)
values
  ('c1000000-0000-4000-8000-000000000001', 'Uji RLS A', '2026/2027'),
  ('c1000000-0000-4000-8000-000000000002', 'Uji RLS B', '2026/2027')
on conflict (id) do nothing;
insert into public.teacher_classes (teacher_id, class_id)
values
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002')
on conflict (teacher_id, class_id) do nothing;
insert into public.students (id, class_id, roll_number, full_name)
values
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 1, 'Santri Uji A'),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 1, 'Santri Uji B')
on conflict (id) do nothing;
select set_config('mutabaah.atomic_attendance_save', 'true', true);
insert into public.attendance_sessions (class_id, attendance_date, prayer_name, recorded_by)
values
  ('c1000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Pontianak')::date, 'subuh', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Pontianak')::date, 'subuh', 'b1000000-0000-4000-8000-000000000002')
on conflict (class_id, attendance_date, prayer_name) do nothing;
insert into public.prayer_attendance (id, student_id, class_id, attendance_date, prayer_name, is_missed, recorded_by)
values
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Pontianak')::date, 'subuh', false, 'a1000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Pontianak')::date, 'subuh', false, 'b1000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

select set_config('mutabaah.atomic_attendance_save', 'false', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
do $$
declare visible_count integer; affected_count integer;
begin
  select count(*) into visible_count from public.prayer_attendance;
  if visible_count <> 1 then raise exception 'Ustaz A seharusnya hanya membaca 1 baris kelasnya, mendapat %', visible_count; end if;
  update public.prayer_attendance set is_missed = true where id = 'e1000000-0000-4000-8000-000000000002';
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'Ustaz A berhasil mengubah absensi kelas ustaz B'; end if;
  update public.profiles set role = 'admin' where id = auth.uid();
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'Ustaz berhasil menaikkan role sendiri'; end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform * from public.prayer_attendance;
    raise exception 'Anon berhasil membaca data absensi';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
rollback;
