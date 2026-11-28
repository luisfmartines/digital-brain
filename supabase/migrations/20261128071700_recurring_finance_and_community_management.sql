grant update(name, bio, category, photo_url) on public.communities to authenticated;
create policy "Edit your own community" on public.communities for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid()) and (
      photo_url is null or length(photo_url) <= 2048 and
      photo_url ~ ('^https?://[^/?#]+/storage/v1/object/public/post-media/' ||
        owner_id || '/' || id || '-[0-9a-f-]{36}[.]jpg$')
    )
  );

create function public.list_community_cards(mine_only boolean, category_filter text default null, search_term text default null)
returns table (id uuid, owner_id uuid, name text, bio text, category text, photo_url text, member_total integer)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.owner_id, c.name, c.bio, c.category, c.photo_url,
    1 + (select count(*)::int from public.community_members m where m.community_id = c.id)
  from public.communities c
  cross join (select auth.uid() as id) me
  where me.id is not null
    and mine_only = (c.owner_id = me.id or exists (
      select 1 from public.community_members m where m.community_id = c.id and m.user_id = me.id
    ))
    and (category_filter is null or c.category = category_filter)
    and (nullif(trim(search_term), '') is null or strpos(lower(c.name), lower(trim(search_term))) > 0)
  order by 7 desc, c.created_at desc, c.id
  limit 60
$$;

revoke execute on function public.list_community_cards(boolean, text, text) from public, anon;
grant execute on function public.list_community_cards(boolean, text, text) to authenticated;

create table public.finance_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  kind text not null check (kind in ('fixed', 'extra', 'leisure', 'other')),
  amount numeric(10,2) not null check (amount > 0),
  description text not null check (length(trim(description)) between 1 and 60),
  category text not null check (length(category) between 1 and 48),
  starts_on date not null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  cancelled_on date,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index finance_recurring_user_idx on public.finance_recurring (user_id, starts_on);

alter table public.transactions
  add column recurring_id uuid,
  add constraint transactions_owns_recurring foreign key (recurring_id, user_id)
    references public.finance_recurring(id, user_id) on delete set null (recurring_id),
  add constraint transactions_recurring_date_key unique (recurring_id, occurred_on);

alter table public.finance_recurring enable row level security;
revoke all on public.finance_recurring from public, anon, authenticated;
grant select, insert on public.finance_recurring to authenticated;
grant update(cancelled_on) on public.finance_recurring to authenticated;

create policy "Read your own recurring transactions" on public.finance_recurring for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Add your own recurring transactions" on public.finance_recurring for insert to authenticated
  with check (user_id = (select auth.uid()) and cancelled_on is null and starts_on between
    (now() at time zone 'America/Sao_Paulo')::date - 1 and (now() at time zone 'America/Sao_Paulo')::date + 3650);
create policy "Cancel your own recurring transactions" on public.finance_recurring for update to authenticated
  using (user_id = (select auth.uid()) and cancelled_on is null)
  with check (user_id = (select auth.uid()) and cancelled_on = (now() at time zone 'America/Sao_Paulo')::date);

create function public.cancel_finance_recurring(rule_id uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.finance_recurring set cancelled_on = (now() at time zone 'America/Sao_Paulo')::date
  where id = rule_id and user_id = (select auth.uid()) and cancelled_on is null
$$;

create function public.sync_finance_recurring()
returns void language sql security invoker set search_path = '' as $$
  with rules as (
    select r.*, least((now() at time zone 'America/Sao_Paulo')::date, r.cancelled_on) as through_date,
      case when r.frequency = 'yearly' then 12 else 1 end as month_step
    from public.finance_recurring r where r.user_id = (select auth.uid())
  ), due as (
    select r.*, case when r.frequency = 'weekly' then r.starts_on + 7 * step.n
      else (r.starts_on + make_interval(months => step.n * r.month_step))::date end as due_date
    from rules r
    cross join lateral generate_series(0, case
      when r.through_date < r.starts_on then -1
      when r.frequency = 'weekly' then (r.through_date - r.starts_on) / 7
      else ((extract(year from r.through_date)::int - extract(year from r.starts_on)::int) * 12
        + extract(month from r.through_date)::int - extract(month from r.starts_on)::int) / r.month_step
    end) step(n)
  )
  insert into public.transactions (user_id, type, kind, amount, description, category, occurred_on, is_recurring, recurring_id)
    select d.user_id, d.type, d.kind, d.amount, d.description, d.category, d.due_date, true, d.id
    from due d where d.due_date <= d.through_date
  on conflict (recurring_id, occurred_on) do nothing
$$;

revoke execute on function public.cancel_finance_recurring(uuid), public.sync_finance_recurring() from public, anon;
grant execute on function public.cancel_finance_recurring(uuid), public.sync_finance_recurring() to authenticated;
