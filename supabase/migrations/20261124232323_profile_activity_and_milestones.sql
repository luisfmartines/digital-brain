alter table public.posts add column milestone_key text;
create unique index posts_milestone_once on public.posts (user_id, milestone_key);

create policy posts_milestones_sharing on public.posts as restrictive for select to authenticated
using (milestone_key is null or user_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = posts.user_id and p.share_profile_details
));

create policy posts_milestones_reserved_insert on public.posts as restrictive for insert to authenticated
with check (milestone_key is null);

create policy posts_milestones_reserved_update on public.posts as restrictive for update to authenticated
using (milestone_key is null) with check (milestone_key is null);

create schema if not exists private;

create function private.publish_perfect_day()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  day_start timestamptz := today::timestamp at time zone 'America/Sao_Paulo';
  next_day timestamptz := (today + 1)::timestamp at time zone 'America/Sao_Paulo';
  modules text[];
begin
  if tg_table_name in ('habit_logs', 'water_logs') then
    if new.log_date <> today then return new; end if;
  elsif tg_table_name = 'tasks' then
    if new.completed_at < day_start or new.completed_at >= next_day then return new; end if;
  elsif new.ended_at < day_start or new.ended_at >= next_day then
    return new;
  end if;

  -- Serialize the check per account, including completions that already earned XP.
  select p.enabled_modules into modules from public.profiles p
  where p.id = new.user_id and p.share_profile_details for no key update;
  if not found then return new; end if;

  if exists (
    select 1 from public.posts p where p.user_id = new.user_id and p.milestone_key = 'perfect-day:' || today::text
  ) then return new; end if;

  -- Match the daily goals on Home, where water always counts.
  if coalesce((select sum(l.ml) from public.water_logs l where l.user_id = new.user_id and l.log_date = today), 0)
    < coalesce((select u.water_goal_ml from public.user_settings u where u.user_id = new.user_id), 2500) then
    return new;
  end if;

  if 'workouts' = any(modules) and not exists (
    select 1 from public.workouts w where w.user_id = new.user_id and w.deleted_at is null
      and w.ended_at >= day_start and w.ended_at < next_day
  ) then return new; end if;

  if exists (
    select 1 from public.habits h where 'habits' = any(modules) and h.user_id = new.user_id
      and h.deleted_at is null and h.archived_at is null and h.created_at < next_day
      and extract(dow from today)::int = any(h.weekdays)
      and not exists (
        select 1 from public.habit_logs l where l.user_id = h.user_id and l.habit_id = h.id and l.log_date = today
      )
    union all
    select 1 from public.tasks t where 'tasks' = any(modules) and t.user_id = new.user_id
      and t.deleted_at is null and t.due_at < next_day and t.completed_at is null
  ) then return new; end if;

  insert into public.posts (user_id, milestone_key, caption)
  values (new.user_id, 'perfect-day:' || today::text, 'Dia 100% concluído!')
  on conflict (user_id, milestone_key) do nothing;
  return new;
end;
$$;

create function private.publish_level_up()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.posts (user_id, milestone_key, caption)
  values (new.id, 'level:' || new.level::text, 'Chegou ao nível ' || new.level::text || '!')
  on conflict (user_id, milestone_key) do nothing;
  return new;
end;
$$;

revoke execute on function private.publish_perfect_day(), private.publish_level_up() from public, anon, authenticated;

create trigger habit_logs_publish_perfect_day
  after insert on public.habit_logs for each row execute function private.publish_perfect_day();

create trigger tasks_publish_perfect_day
  after insert or update of completed_at on public.tasks for each row
  when (new.completed_at is not null and new.deleted_at is null)
  execute function private.publish_perfect_day();

create trigger water_logs_publish_perfect_day
  after insert on public.water_logs for each row execute function private.publish_perfect_day();

create trigger workouts_publish_perfect_day
  after insert or update of ended_at on public.workouts for each row
  when (new.ended_at is not null and new.deleted_at is null)
  execute function private.publish_perfect_day();

create trigger profiles_publish_level_up
  after update of level on public.profiles for each row
  when (new.level > old.level and new.share_profile_details)
  execute function private.publish_level_up();

create function public.read_profile_activity(viewer uuid, target uuid)
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

create function public.copy_profile_workout(viewer uuid, source_workout uuid)
returns uuid language plpgsql set search_path = '' as $$
declare
  original public.workouts;
  new_routine uuid;
  item record;
  exercise_key text;
begin
  select w.* into original from public.workouts w join public.profiles p on p.id = w.user_id
  where w.id = source_workout and w.ended_at is not null and w.deleted_at is null
    and (w.user_id = viewer or p.share_profile_details)
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

revoke execute on function public.read_profile_activity(uuid, uuid), public.copy_profile_workout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_profile_activity(uuid, uuid), public.copy_profile_workout(uuid, uuid) to service_role;
