drop policy if exists students_admin_insert on public.students;

create policy students_insert_assigned on public.students for insert to authenticated
with check ((select public.is_admin()) or (select public.teacher_has_class(class_id)));
