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
    left join public.workouts w on w.id = f.workout_id and w.deleted_at is null
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
