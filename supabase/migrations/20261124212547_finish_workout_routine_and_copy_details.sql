create function public.finish_workout_session(session_id uuid, update_routine boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  active public.workouts;
  finished_at timestamptz := now();
  planned_rows jsonb;
begin
  select w.* into active from public.workouts w
  where w.id = session_id and w.user_id = owner_id and w.deleted_at is null
  for update;
  if not found then raise exception 'Workout unavailable'; end if;
  if active.ended_at is not null then return; end if;
  if not exists (
    select 1 from public.workout_sets s
    where s.workout_id = session_id and s.user_id = owner_id and s.completed
  ) then raise exception 'Complete a set before finishing'; end if;

  if update_routine then
    perform 1 from public.workout_routines r
    where r.id = active.routine_id and r.user_id = owner_id and r.deleted_at is null
    for update;
    if not found then raise exception 'Routine unavailable'; end if;

    -- Keep the prescription of the original slot, including for a replacement.
    with original as (
      select re.*, row_number() over (order by re.position, re.id) - 1 as slot
      from public.routine_exercises re where re.routine_id = active.routine_id and re.user_id = owner_id
    ), grouped as (
      select s.exercise_id, s.exercise_order, count(*)::integer as sets
      from public.workout_sets s where s.workout_id = session_id and s.user_id = owner_id
      group by s.exercise_id, s.exercise_order
    ), updated as (
      select g.exercise_id, row_number() over (order by g.exercise_order, g.exercise_id) - 1 as position,
        g.sets as target_sets, o.target_reps, o.reps_min, o.reps_max, coalesce(o.rest_seconds, 90) as rest_seconds
      from grouped g left join original o on o.slot = g.exercise_order
    )
    select jsonb_agg(to_jsonb(u)) into planned_rows from updated u;

    delete from public.routine_exercises re where re.routine_id = active.routine_id and re.user_id = owner_id;
    insert into public.routine_exercises (
      user_id, routine_id, exercise_id, position, target_sets, target_reps, reps_min, reps_max, rest_seconds
    )
    select owner_id, active.routine_id, p.exercise_id, p.position, p.target_sets, p.target_reps, p.reps_min, p.reps_max, p.rest_seconds
    from jsonb_to_recordset(planned_rows) as p(
      exercise_id text, position integer, target_sets integer, target_reps integer,
      reps_min integer, reps_max integer, rest_seconds integer
    );
  end if;

  update public.workouts w
  set ended_at = finished_at, paused_at = null,
    paused_seconds = w.paused_seconds + coalesce(greatest(0, floor(extract(epoch from (finished_at - w.paused_at))))::integer, 0)
  where w.id = session_id and w.user_id = owner_id;
end
$$;

revoke execute on function public.finish_workout_session(uuid, boolean) from public, anon;
grant execute on function public.finish_workout_session(uuid, boolean) to authenticated;

create or replace function public.copy_shared_routine(viewer uuid, source_routine uuid)
returns uuid language plpgsql set search_path = '' as $$
declare
  original public.workout_routines;
  new_routine uuid;
  item record;
  exercise_key text;
begin
  select r.* into original
  from public.workout_routines r join public.profiles p on p.id = r.user_id
  where r.id = source_routine and r.deleted_at is null and p.share_profile_details and r.user_id <> viewer;
  if not found then return null; end if;

  insert into public.workout_routines (user_id, name, focus, tags)
  values (viewer, original.name, original.focus, original.tags) returning id into new_routine;

  for item in
    select re.position, re.target_sets, re.target_reps, re.reps_min, re.reps_max,
      re.rest_seconds, x.id, x.user_id, x.name, x.muscle_group, x.equipment, m.external_id
    from public.routine_exercises re
    join public.exercises x on x.id = re.exercise_id
    left join public.exercise_media_links m on m.exercise_id = x.id and m.user_id = original.user_id
    where re.routine_id = source_routine and re.user_id = original.user_id
      and (x.user_id is null or x.user_id = original.user_id)
    order by re.position, re.id
  loop
    exercise_key := item.id;
    if item.user_id is not null then
      exercise_key := viewer::text || ':' || coalesce(item.external_id, 'copy:' || md5(item.id));
      insert into public.exercises (id, user_id, name, muscle_group, equipment)
      values (exercise_key, viewer, item.name, item.muscle_group, item.equipment)
      on conflict (id) do nothing;
    end if;
    if item.external_id is not null then
      insert into public.exercise_media_links (user_id, exercise_id, external_id)
      values (viewer, exercise_key, item.external_id)
      on conflict (user_id, exercise_id) do nothing;
    end if;
    insert into public.routine_exercises (user_id, routine_id, exercise_id, position, target_sets, target_reps, reps_min, reps_max, rest_seconds)
    values (viewer, new_routine, exercise_key, item.position, item.target_sets, item.target_reps, item.reps_min, item.reps_max, item.rest_seconds);
  end loop;
  return new_routine;
end
$$;

