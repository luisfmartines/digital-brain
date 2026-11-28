create function public.remove_finished_workout_photo(session_id uuid, photo_url_to_remove text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  photos text[];
begin
  select case when cardinality(w.photo_urls) > 0 then w.photo_urls
              when w.photo_url is not null then array[w.photo_url] else '{}'::text[] end
    into photos
    from public.workouts w
    where w.id = session_id and w.user_id = owner_id
      and w.ended_at is not null and w.deleted_at is null
    for update;
  if not found then raise exception 'Workout unavailable'; end if;
  if photo_url_to_remove is null or not (photo_url_to_remove = any(photos)) then return false; end if;

  photos := array_remove(photos, photo_url_to_remove);
  update public.workouts set photo_urls = photos, photo_url = photos[1] where id = session_id;

  with matching_posts as (
    select p.id, array_remove(
      case when cardinality(p.photo_urls) > 0 then p.photo_urls
           else array[p.photo_url] end,
      photo_url_to_remove
    ) as remaining
    from public.posts p
    where p.user_id = owner_id and p.workout_id = session_id
      and p.deleted_at is null and p.milestone_key is null
      and (p.photo_url = photo_url_to_remove or photo_url_to_remove = any(p.photo_urls))
  )
  update public.posts p
    set photo_urls = m.remaining, photo_url = m.remaining[1]
    from matching_posts m where p.id = m.id;

  return true;
end
$$;

revoke execute on function public.remove_finished_workout_photo(uuid, text) from public, anon;
grant execute on function public.remove_finished_workout_photo(uuid, text) to authenticated;
