alter table public.workout_sets
  add column set_type text,
  add constraint workout_sets_set_type_check
    check (set_type in ('normal', 'warmup', 'preparatory', 'drop_set', 'bi_set'));
