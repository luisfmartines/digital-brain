alter table public.profiles add column share_profile_details boolean not null default false;
grant select (share_profile_details), update (share_profile_details) on public.profiles to authenticated;

create function public.read_shared_profile(target uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'username', p.username, 'avatar', p.avatar_url,
    'bio', p.bio, 'level', p.level, 'sharing', p.share_profile_details,
    'completion', case when p.share_profile_details then (
      select round(100.0 * count(*) filter (where exists (
        select 1 from public.habit_logs log
        where log.user_id = target and log.habit_id = h.id and log.log_date = d.day
      )) / nullif(count(*), 0))
      from public.habits h
      cross join lateral (
        select (now() at time zone 'America/Sao_Paulo')::date - n as day
        from generate_series(1, 30) n
      ) d
      where h.user_id = target and h.deleted_at is null and h.archived_at is null
        and d.day >= (h.created_at at time zone 'America/Sao_Paulo')::date
        and extract(dow from d.day)::integer = any(h.weekdays)
    ) end,
    'routines', case when p.share_profile_details then coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'focus', r.focus,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', x.name, 'sets', re.target_sets, 'reps', coalesce(re.target_reps, re.reps_max, re.reps_min),
            'rest', re.rest_seconds
          ) order by re.position, re.id)
          from public.routine_exercises re
          join public.exercises x on x.id = re.exercise_id
          where re.routine_id = r.id and re.user_id = target and (x.user_id is null or x.user_id = target)
        ), '[]'::jsonb)
      ) order by r.created_at desc, r.id)
      from public.workout_routines r where r.user_id = target and r.deleted_at is null
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.profiles p where p.id = target
$$;

create function public.copy_shared_routine(viewer uuid, source_routine uuid)
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
    select re.position, re.target_sets, coalesce(re.target_reps, re.reps_max, re.reps_min) as reps,
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
      if item.external_id is not null then
        insert into public.exercise_media_links (user_id, exercise_id, external_id)
        values (viewer, exercise_key, item.external_id)
        on conflict (user_id, exercise_id) do nothing;
      end if;
    end if;
    insert into public.routine_exercises (user_id, routine_id, exercise_id, position, target_sets, target_reps, rest_seconds)
    values (viewer, new_routine, exercise_key, item.position, item.target_sets, item.reps, item.rest_seconds);
  end loop;
  return new_routine;
end
$$;

revoke execute on function public.read_shared_profile(uuid), public.copy_shared_routine(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_shared_profile(uuid), public.copy_shared_routine(uuid, uuid) to service_role;
