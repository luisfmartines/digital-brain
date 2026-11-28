create function public.publish_finished_workout()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.posts (user_id, workout_id, photo_url, photo_urls)
    select new.user_id, new.id, new.photo_url, new.photo_urls
    where not exists (
      select 1 from public.posts p where p.user_id = new.user_id and p.workout_id = new.id
        and p.deleted_at is null and p.milestone_key is null
    );
  return new;
end
$$;

-- Finalization and publication commit together, including for older clients.
create trigger publish_finished_workout after update of ended_at on public.workouts
  for each row when (old.ended_at is null and new.ended_at is not null and new.deleted_at is null)
  execute function public.publish_finished_workout();

create function public.finish_workout_with_photos(session_id uuid, update_routine boolean, selected_photos text[])
returns text[] language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout public.workouts;
  photo_pattern text := '^https?://[^/?#]+/storage/v1/object/public/post-media/' ||
    owner_id || '/' || session_id || '-[0-9a-f-]{36}[.]jpg$';
begin
  select w.* into workout from public.workouts w
    where w.id = session_id and w.user_id = owner_id and w.deleted_at is null
    for update;
  if not found then raise exception 'Workout unavailable'; end if;
  if workout.ended_at is not null then return workout.photo_urls; end if;

  if selected_photos is null or cardinality(selected_photos) > 6 or exists (
    select 1 from unnest(selected_photos) p where p is null or length(p) > 2048 or p !~ photo_pattern
  ) then
    raise exception 'Invalid workout photos';
  end if;

  update public.workouts set photo_urls = selected_photos, photo_url = selected_photos[1] where id = session_id;
  perform public.finish_workout_session(session_id, update_routine);
  return selected_photos;
end
$$;

revoke execute on function public.publish_finished_workout() from public, anon, authenticated;
revoke execute on function public.finish_workout_with_photos(uuid, boolean, text[]) from public, anon;
grant execute on function public.finish_workout_with_photos(uuid, boolean, text[]) to authenticated;
