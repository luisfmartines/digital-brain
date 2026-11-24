-- Allow authenticated users to read the metadata of their own profile photo for upserts.
create policy avatars_select_own_profile_photo
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/profile.jpg'
);
