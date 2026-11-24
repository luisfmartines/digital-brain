alter table public.profiles alter column share_profile_details set default true;

alter table public.xp_events add column activity_date date;

-- Keep one award per completed task and per habit on its logged date.
create unique index xp_events_task_once
  on public.xp_events (user_id, ref_id) where source = 'task';

create unique index xp_events_habit_per_day
  on public.xp_events (user_id, ref_id, activity_date) where source = 'habit';

create schema if not exists private;

create function private.award_task_completion_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.xp_events (user_id, source, amount, ref_id)
  values (new.user_id, 'task', 20, new.id)
  on conflict (user_id, ref_id) where source = 'task' do nothing;
  return new;
end;
$$;

create function private.award_habit_completion_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.xp_events (user_id, source, amount, ref_id, activity_date)
  select new.user_id, 'habit', 10, new.habit_id, new.log_date
  where exists (
    select 1 from public.habits h
    where h.id = new.habit_id and h.user_id = new.user_id and h.deleted_at is null
  )
  on conflict (user_id, ref_id, activity_date) where source = 'habit' do nothing;
  return new;
end;
$$;

revoke execute on function private.award_task_completion_xp(), private.award_habit_completion_xp()
  from public, anon, authenticated;

create trigger tasks_award_xp_on_insert
  after insert on public.tasks
  for each row
  when (new.completed_at is not null and new.deleted_at is null)
  execute function private.award_task_completion_xp();

create trigger tasks_award_xp_on_completion
  after update of completed_at on public.tasks
  for each row
  when (old.completed_at is null and new.completed_at is not null and new.deleted_at is null)
  execute function private.award_task_completion_xp();

create trigger habit_logs_award_xp
  after insert on public.habit_logs
  for each row
  execute function private.award_habit_completion_xp();
