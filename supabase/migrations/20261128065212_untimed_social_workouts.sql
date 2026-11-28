create or replace function public.publish_social_post(
  draft_id uuid, post_caption text, selected_photos text[], explore boolean,
  activity_category text, activity_name text, activity_minutes integer, activity_distance numeric
)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved_photos text[];
  session_id uuid;
  finished_at timestamptz := now();
  photo_pattern text := '^https?://[^/?#]+/storage/v1/object/public/post-media/' ||
    actor || '/' || draft_id || '-[0-9a-f-]{36}[.]jpg$';
begin
  if actor is null or draft_id is null then raise exception 'Post unavailable'; end if;

  -- Serialize retries of the same draft so a successful request can reuse its attachments.
  perform pg_advisory_xact_lock(hashtextextended(draft_id::text, 0));
  select p.photo_urls into saved_photos from public.posts p where p.id = draft_id and p.user_id = actor;
  if found then return saved_photos; end if;

  if length(coalesce(post_caption, '')) > 1500 or
    selected_photos is null or cardinality(selected_photos) > 6 or
    exists (select 1 from unnest(selected_photos) p where p is null or length(p) > 2048 or p !~ photo_pattern)
  then
    raise exception 'Invalid post';
  end if;

  if activity_category is not null then
    if (activity_minutes is not null and activity_minutes not between 1 and 1440) or
      (activity_minutes is null and activity_distance is not null) or
      length(trim(activity_name)) > 80
    then
      raise exception 'Invalid activity';
    end if;
    session_id := draft_id;
    insert into public.workouts (id, user_id, name, started_at, ended_at, activity_category, distance_km, photo_url, photo_urls)
      values (session_id, actor, coalesce(nullif(trim(activity_name), ''), trim(activity_category)),
        finished_at - make_interval(mins => coalesce(activity_minutes, 0)),
        finished_at, trim(activity_category), activity_distance, selected_photos[1], selected_photos);
  elsif nullif(trim(post_caption), '') is null and cardinality(selected_photos) = 0 then
    raise exception 'Empty post';
  end if;

  insert into public.posts (id, user_id, workout_id, caption, photo_url, photo_urls, discoverable)
    values (draft_id, actor, session_id, nullif(trim(post_caption), ''), selected_photos[1], selected_photos, coalesce(explore, false));
  return selected_photos;
end
$$;

create table public.workout_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '' check (length(description) <= 500),
  starts_on date not null,
  duration_days integer not null check (duration_days between 1 and 365),
  ends_on date generated always as (starts_on + duration_days) stored,
  created_at timestamptz not null default now()
);

create table public.workout_challenge_members (
  challenge_id uuid not null references public.workout_challenges(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index workout_challenges_recent_idx on public.workout_challenges (created_at desc, id desc);
create index workout_challenges_creator_idx on public.workout_challenges (created_by);
create index workout_challenge_members_user_idx on public.workout_challenge_members (user_id);
create index workouts_challenge_days_idx on public.workouts (user_id, ended_at)
  where deleted_at is null and ended_at is not null;

alter table public.workout_challenges enable row level security;
alter table public.workout_challenge_members enable row level security;
revoke all on public.workout_challenges, public.workout_challenge_members from public, anon, authenticated;
grant select, insert on public.workout_challenges to authenticated;
grant select, insert, delete on public.workout_challenge_members to authenticated;

create policy "Authenticated users can read workout challenges" on public.workout_challenges for select to authenticated using (true);
create policy "Create a workout challenge as yourself" on public.workout_challenges for insert to authenticated
  with check (created_by = (select auth.uid()) and starts_on between
    (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date + 365);
create policy "Authenticated users can read workout challenge memberships" on public.workout_challenge_members for select to authenticated using (true);
create policy "Join an open workout challenge as yourself" on public.workout_challenge_members for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.workout_challenges c where c.id = challenge_id
      and c.created_by <> (select auth.uid()) and c.ends_on > (now() at time zone 'America/Sao_Paulo')::date
  ));
create policy "Leave a workout challenge as yourself" on public.workout_challenge_members for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.list_workout_challenges(page_offset integer default 0)
returns table (
  id uuid, name text, description text, starts_on date, ends_on date, duration_days integer,
  participant_count integer, active_days integer, joined boolean, is_creator boolean, closed boolean
)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.name, c.description, c.starts_on, c.ends_on, c.duration_days,
    1 + (select count(*)::int from public.workout_challenge_members m where m.challenge_id = c.id),
    case when c.created_by = me.id or membership.user_id is not null then (
      select count(distinct (w.ended_at at time zone 'America/Sao_Paulo')::date)::int
      from public.workouts w
      where w.user_id = me.id and w.deleted_at is null
        and w.ended_at >= (c.starts_on::timestamp at time zone 'America/Sao_Paulo')
        and w.ended_at < (c.ends_on::timestamp at time zone 'America/Sao_Paulo')
    ) else 0 end,
    c.created_by = me.id or membership.user_id is not null,
    c.created_by = me.id,
    c.ends_on <= (now() at time zone 'America/Sao_Paulo')::date
  from (
    select * from public.workout_challenges
    order by created_at desc, id desc
    limit 20 offset greatest(page_offset, 0)
  ) c
  cross join (select auth.uid() as id) me
  left join public.workout_challenge_members membership on membership.challenge_id = c.id and membership.user_id = me.id
  where me.id is not null
  order by c.created_at desc, c.id desc
$$;

revoke execute on function public.list_workout_challenges(integer) from public, anon;
grant execute on function public.list_workout_challenges(integer) to authenticated;
