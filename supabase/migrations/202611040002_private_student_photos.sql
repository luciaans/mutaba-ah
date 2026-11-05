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
