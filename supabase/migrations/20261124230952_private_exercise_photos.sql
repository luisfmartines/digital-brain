alter table public.exercises
  add column photo_path text,
  add constraint exercises_photo_owner check (
    photo_path is null or (user_id is not null and photo_path = user_id::text || '/' || id || '.jpg')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-photos', 'exercise-photos', false, 5242880, array['image/jpeg']);

create policy "Owners can upload exercise photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners can read exercise photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners can remove exercise photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
