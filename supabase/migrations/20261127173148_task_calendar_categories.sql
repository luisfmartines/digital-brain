alter table public.tasks
  drop constraint tasks_category_check,
  add constraint tasks_category_check
    check (category in ('work', 'meeting', 'health', 'personal', 'fitness', 'mindset'));
