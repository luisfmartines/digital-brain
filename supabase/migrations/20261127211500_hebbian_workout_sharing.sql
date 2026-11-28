alter table public.workouts add column photo_urls text[] not null default '{}',
  add constraint workouts_photo_count check (cardinality(photo_urls) <= 6);
alter table public.posts add column photo_urls text[] not null default '{}',
  add constraint posts_photo_count check (cardinality(photo_urls) <= 6);

create function public.append_workout_photo(session_id uuid, photo_url_to_add text)
returns void language plpgsql security invoker set search_path = '' as $$
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
  if not found or nullif(trim(photo_url_to_add), '') is null then
    raise exception 'Workout photo unavailable';
  end if;
  if photo_url_to_add = any(photos) then return; end if;
  if cardinality(photos) >= 6 then raise exception 'Workout photo limit reached'; end if;
  photos := array_append(photos, photo_url_to_add);
  update public.workouts set photo_urls = photos, photo_url = photos[1] where id = session_id;
  update public.posts set photo_urls = photos, photo_url = photos[1]
    where workout_id = session_id and user_id = owner_id and deleted_at is null and milestone_key is null;
end
$$;

create function public.share_workout_post(session_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout public.workouts;
begin
  select w.* into workout from public.workouts w
    where w.id = session_id and w.user_id = owner_id
      and w.ended_at is not null and w.deleted_at is null
    for update;
  if not found then raise exception 'Workout unavailable'; end if;
  if exists (
    select 1 from public.posts where workout_id = session_id and user_id = owner_id
      and deleted_at is null and milestone_key is null
  ) then return; end if;
  insert into public.posts (user_id, workout_id, photo_url, photo_urls)
    values (owner_id, session_id, workout.photo_url, workout.photo_urls);
end
$$;

revoke execute on function public.append_workout_photo(uuid, text), public.share_workout_post(uuid) from public, anon;
grant execute on function public.append_workout_photo(uuid, text), public.share_workout_post(uuid) to authenticated;

-- The workout and set policies restrict these reads to completed, visible posts.
create policy "Exercises in shared workouts" on public.exercises for select to authenticated
  using (exists (
    select 1 from public.workout_sets s join public.workouts w on w.id = s.workout_id
    where s.exercise_id = exercises.id and s.user_id = exercises.user_id
      and w.user_id = s.user_id and w.user_id <> (select auth.uid())
      and w.ended_at is not null and w.deleted_at is null and s.completed
  ));

create policy "Demonstrations in shared workouts" on public.exercise_media_links for select to authenticated
  using (exists (
    select 1 from public.workout_sets s join public.workouts w on w.id = s.workout_id
    where s.exercise_id = exercise_media_links.exercise_id and s.user_id = exercise_media_links.user_id
      and w.user_id = s.user_id and w.user_id <> (select auth.uid())
      and w.ended_at is not null and w.deleted_at is null and s.completed
  ));

create policy "Photos in shared workouts" on storage.objects for select to authenticated
  using (bucket_id = 'exercise-photos' and exists (
    select 1 from public.exercises e where e.photo_path = objects.name and e.user_id <> (select auth.uid())
  ));

create policy "Owners can replace exercise photos" on storage.objects for update to authenticated
  using (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.check_workout_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workout_sets where workout_id = new.id and user_id = new.user_id
  ) or exists (
    select 1 from public.workout_sets where workout_id = new.id and user_id = new.user_id
      and (completed is not true or coalesce(reps, 0) < 1)
  ) then
    raise exception using message = 'Workout has pending sets', errcode = '23514';
  end if;
  return new;
end
$$;

create trigger check_workout_completion before update of ended_at on public.workouts
  for each row when (old.ended_at is null and new.ended_at is not null)
  execute function public.check_workout_completion();

-- Serialize set mutations with finalization so a stale editing session cannot leave a finished workout incomplete.
create function public.lock_active_workout_for_set()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  session_id uuid := case when tg_op = 'INSERT' then new.workout_id else old.workout_id end;
  finished_at timestamptz;
begin
  if tg_op = 'UPDATE' and (old.workout_id, old.user_id) is distinct from (new.workout_id, new.user_id) then
    raise exception 'Cannot move a set to another workout';
  end if;
  select w.ended_at into finished_at from public.workouts w
    where w.id = session_id and w.user_id = auth.uid() for update;
  if found and finished_at is not null then
    raise exception using message = 'Workout already finished', errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger lock_active_workout_for_set before insert or update or delete on public.workout_sets
  for each row execute function public.lock_active_workout_for_set();

revoke execute on function public.check_workout_completion(), public.lock_active_workout_for_set() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_workout_xp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare vol numeric;
begin
  if old.ended_at is null and new.ended_at is not null then
    select coalesce(sum(weight_kg * reps), 0) into vol
      from public.workout_sets
     where workout_id = new.id and completed;
    insert into public.xp_events (user_id, source, amount, ref_id)
    values (new.user_id, 'workout', least(500, 50 + round(vol / 100))::int, new.id);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.leaderboard_week(from_ts timestamp with time zone, to_ts timestamp with time zone)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, volume_kg numeric, minutes integer, sets integer, workouts integer, xp integer, last_workout text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with members as (
    select auth.uid() as id
    union
    select following_id from public.follows where follower_id = auth.uid()
  ), fin as (
    select w.id, w.user_id, w.name, w.started_at,
           greatest(extract(epoch from (w.ended_at - w.started_at)) - w.paused_seconds, 0) as secs
      from public.workouts w
     where w.user_id in (select id from members)
       and w.ended_at is not null and w.deleted_at is null
       and w.ended_at >= from_ts and w.ended_at < to_ts
  )
  select p.id, p.display_name, p.username, p.avatar_url,
    coalesce((select sum(s.weight_kg * s.reps) from public.workout_sets s join fin d on d.id = s.workout_id
               where d.user_id = p.id and s.completed), 0)::numeric,
    (coalesce((select sum(d.secs) from fin d where d.user_id = p.id), 0) / 60)::int,
    coalesce((select count(*) from public.workout_sets s join fin d on d.id = s.workout_id
               where d.user_id = p.id and s.completed and not s.is_warmup), 0)::int,
    (select count(*) from fin d where d.user_id = p.id)::int,
    coalesce((select sum(x.amount) from public.xp_events x
               where x.user_id = p.id and x.source = 'workout'
                 and x.created_at >= from_ts and x.created_at < to_ts), 0)::int,
    (select d.name from fin d
      where d.user_id = p.id and (
        d.user_id = auth.uid() or exists (
          select 1 from public.posts shared
          where shared.workout_id = d.id and shared.user_id = d.user_id
            and shared.deleted_at is null and shared.milestone_key is null
        )
      )
      order by d.started_at desc limit 1)
  from public.profiles p
  where p.id in (select id from members)
$function$;

CREATE OR REPLACE FUNCTION public.read_profile_activity(viewer uuid, target uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with profile as (
    select p.id, p.share_profile_details, p.id = viewer or p.share_profile_details as can_read
    from public.profiles p where p.id = target
  ), bounds as (
    select date_trunc('week', now() at time zone 'America/Sao_Paulo') as current_week
  ), workouts as (
    select w.id, w.name, w.ended_at, w.photo_url,
      greatest(extract(epoch from (w.ended_at - w.started_at)) - w.paused_seconds, 0)::int as seconds
    from public.workouts w join profile p on p.id = w.user_id and p.can_read
    where w.ended_at is not null and w.deleted_at is null
      and (w.user_id = viewer or exists (
      select 1 from public.posts shared
      join public.follows f on f.following_id = shared.user_id and f.follower_id = viewer
      where shared.workout_id = w.id and shared.user_id = w.user_id
        and shared.deleted_at is null and shared.milestone_key is null
    ))
  ), week_volume as (
    select (w.ended_at at time zone 'America/Sao_Paulo')::date as day,
      count(*) as workouts, sum(v.volume) as volume, sum(w.seconds) as seconds
    from workouts w cross join bounds b
    cross join lateral (
      select coalesce(sum(s.weight_kg * s.reps), 0) as volume
      from public.workout_sets s
      where s.workout_id = w.id and s.user_id = target and s.completed
    ) v
    where w.ended_at >= (b.current_week at time zone 'America/Sao_Paulo')
      and w.ended_at < ((b.current_week + interval '1 week') at time zone 'America/Sao_Paulo')
    group by (w.ended_at at time zone 'America/Sao_Paulo')::date
  ), recent as (
    select * from workouts order by ended_at desc, id desc limit 6
  ), posts as (
    select f.id, f.created_at, f.photo_url, f.caption, f.workout_id, w.name as workout_name
    from public.posts f
    join profile p on p.id = f.user_id
    left join public.workouts w on w.id = f.workout_id and w.user_id = f.user_id and w.ended_at is not null and w.deleted_at is null
    where f.deleted_at is null and (f.milestone_key is null or p.can_read)
      and (viewer = target or exists (select 1 from public.follows x where x.follower_id = viewer and x.following_id = target))
    order by f.created_at desc, f.id desc limit 12
  ), photos as (
    select p.photo_url as url, coalesce(p.workout_name, 'Foto publicada') as name, p.created_at as at
    from posts p where p.photo_url is not null and viewer <> target
    union all
    select w.photo_url, w.name, w.ended_at from workouts w where w.photo_url is not null and viewer = target
  )
  select jsonb_build_object(
    'workoutCount', case when p.can_read then (select count(*) from workouts) end,
    'followers', (select count(*) from public.follows f where f.following_id = target),
    'following', (select count(*) from public.follows f where f.follower_id = target),
    'weeks', case when p.can_read then (
      select jsonb_agg(jsonb_build_object('date', d.week::date, 'seconds', coalesce((
        select sum(w.seconds) from workouts w where w.ended_at >= (d.week at time zone 'America/Sao_Paulo')
          and w.ended_at < ((d.week + interval '1 week') at time zone 'America/Sao_Paulo')
      ), 0)) order by d.week)
      from generate_series(b.current_week - interval '5 weeks', b.current_week, interval '1 week') d(week)
    ) else '[]'::jsonb end,
    'weekVolume', case when p.can_read then (
      select jsonb_agg(jsonb_build_object('date', d.day::date,
        'volume', coalesce(v.volume, 0), 'workouts', coalesce(v.workouts, 0), 'seconds', coalesce(v.seconds, 0)) order by d.day)
      from generate_series(b.current_week, b.current_week + interval '6 days', interval '1 day') d(day)
      left join week_volume v on v.day = d.day::date
    ) else '[]'::jsonb end,
    'photos', coalesce((select jsonb_agg(to_jsonb(photo) order by photo.at desc)
      from (select * from photos order by at desc limit 6) photo), '[]'::jsonb),
    'workouts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.id, 'name', w.name, 'ended_at', w.ended_at, 'seconds', w.seconds,
      'volume', coalesce((select sum(s.weight_kg * s.reps) from public.workout_sets s
        where s.workout_id = w.id and s.completed), 0),
      'exercises', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'sets', x.sets) order by x.exercise_order)
        from (select e.name, s.exercise_order, count(*) as sets
          from public.workout_sets s join public.exercises e on e.id = s.exercise_id
          where s.workout_id = w.id and s.user_id = target and s.completed
          group by s.exercise_order, e.id, e.name) x), '[]'::jsonb)
      ) order by w.ended_at desc, w.id desc) from recent w), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc, f.id desc) from posts f), '[]'::jsonb)
  )
  from profile p cross join bounds b
$function$;
