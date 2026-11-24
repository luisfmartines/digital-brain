-- Local exercise records are required by routine/workout joins. ExerciseDB remains
-- the browsable catalogue; only selected exercises are saved for each user.
create table public.exercises (
  id text primary key default gen_random_uuid()::text,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text
);
create index exercises_user_id_idx on public.exercises(user_id);
alter table public.exercises enable row level security;
grant select, insert, update, delete on public.exercises to authenticated;
create policy exercises_read on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));
alter table public.routine_exercises add constraint routine_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id);
alter table public.workout_sets add constraint workout_sets_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id);
notify pgrst, 'reload schema';
