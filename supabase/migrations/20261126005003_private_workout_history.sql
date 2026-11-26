-- Personal workouts are visible to others only through an active post by their owner.
alter policy workouts_select on public.workouts
using (
  user_id = (select auth.uid())
  or (
    ended_at is not null and deleted_at is null
    and exists (
      select 1 from public.posts p
      where p.workout_id = workouts.id and p.user_id = workouts.user_id
        and p.deleted_at is null and p.milestone_key is null
    )
  )
);

alter policy workout_sets_select on public.workout_sets
using (
  user_id = (select auth.uid())
  or (
    completed and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id and w.user_id = workout_sets.user_id
        and w.ended_at is not null and w.deleted_at is null
    )
  )
);

create or replace function public.read_profile_activity(viewer uuid, target uuid)
returns jsonb language sql stable set search_path = '' as $$
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
      where s.workout_id = w.id and s.user_id = target and s.completed and not s.is_warmup
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
        where s.workout_id = w.id and s.completed and not s.is_warmup), 0),
      'exercises', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'sets', x.sets) order by x.exercise_order)
        from (select e.name, s.exercise_order, count(*) as sets
          from public.workout_sets s join public.exercises e on e.id = s.exercise_id
          where s.workout_id = w.id and s.user_id = target and s.completed
          group by s.exercise_order, e.id, e.name) x), '[]'::jsonb)
      ) order by w.ended_at desc, w.id desc) from recent w), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc, f.id desc) from posts f), '[]'::jsonb)
  )
  from profile p cross join bounds b
$$;

create or replace function public.copy_profile_workout(viewer uuid, source_workout uuid)
returns uuid language plpgsql set search_path = '' as $$
declare
  original public.workouts;
  new_routine uuid;
  item record;
  exercise_key text;
begin
  select w.* into original from public.workouts w join public.profiles p on p.id = w.user_id
  where w.id = source_workout and w.ended_at is not null and w.deleted_at is null
    and (w.user_id = viewer or (p.share_profile_details and exists (
      select 1 from public.posts shared
      join public.follows f on f.following_id = shared.user_id and f.follower_id = viewer
      where shared.workout_id = w.id and shared.user_id = w.user_id
        and shared.deleted_at is null and shared.milestone_key is null
    )))
    and exists (select 1 from public.workout_sets s where s.workout_id = w.id and s.user_id = w.user_id and s.completed);
  if not found then return null; end if;

  insert into public.workout_routines (user_id, name) values (viewer, original.name) returning id into new_routine;
  for item in
    select (row_number() over (order by g.exercise_order, e.id) - 1)::int as position,
      coalesce(nullif(g.work_sets, 0), g.sets) as sets, e.id, e.user_id, e.name, e.muscle_group, e.equipment, m.external_id
    from (select s.exercise_id, s.exercise_order, count(*)::int as sets,
      (count(*) filter (where not s.is_warmup))::int as work_sets
      from public.workout_sets s where s.workout_id = source_workout and s.user_id = original.user_id and s.completed
      group by s.exercise_id, s.exercise_order) g
    join public.exercises e on e.id = g.exercise_id and (e.user_id is null or e.user_id = original.user_id)
    left join public.exercise_media_links m on m.exercise_id = e.id and m.user_id = original.user_id
  loop
    exercise_key := item.id;
    if item.user_id is not null and item.user_id <> viewer then
      exercise_key := viewer::text || ':' || coalesce(item.external_id, 'copy:' || md5(item.id));
      insert into public.exercises (id, user_id, name, muscle_group, equipment)
      values (exercise_key, viewer, item.name, item.muscle_group, item.equipment)
      on conflict (id) do nothing;
    end if;
    if item.external_id is not null then
      insert into public.exercise_media_links (user_id, exercise_id, external_id)
      values (viewer, exercise_key, item.external_id) on conflict (user_id, exercise_id) do nothing;
    end if;
    insert into public.routine_exercises (user_id, routine_id, exercise_id, position, target_sets)
    values (viewer, new_routine, exercise_key, item.position, least(item.sets, 10));
  end loop;
  return new_routine;
end;
$$;

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
               where d.user_id = p.id and s.completed and not s.is_warmup), 0)::numeric,
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
