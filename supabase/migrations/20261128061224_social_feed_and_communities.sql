alter table public.posts add column discoverable boolean not null default false;
create index posts_discoverable_recent_idx on public.posts (created_at desc)
  where discoverable and deleted_at is null;

create policy "Read posts shared in Explore" on public.posts for select to authenticated
  using (discoverable and deleted_at is null and milestone_key is null);

create function public.in_friends_feed(public.posts)
returns boolean language sql stable security invoker set search_path = '' as $$
  select $1.user_id = (select auth.uid()) or exists (
    select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.following_id = $1.user_id
  )
$$;

revoke execute on function public.in_friends_feed(public.posts) from public, anon;
grant execute on function public.in_friends_feed(public.posts) to authenticated;

create policy "Like only visible posts" on public.post_likes as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.posts p where p.id = post_id and p.deleted_at is null
  ));

create policy "Owners can find their uploaded post media" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.workouts
  add column activity_category text check (length(trim(activity_category)) between 1 and 40),
  add column distance_km numeric(7, 2) check (distance_km between 0.01 and 2000),
  add constraint workouts_distance_requires_activity check (distance_km is null or activity_category is not null);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 64),
  bio text not null default '' check (length(bio) <= 500),
  category text not null check (length(trim(category)) between 1 and 40),
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index communities_recent_idx on public.communities (created_at desc);
create index communities_category_recent_idx on public.communities (category, created_at desc);
create index communities_owner_idx on public.communities (owner_id);
create index community_members_user_idx on public.community_members (user_id);
create index community_members_joined_idx on public.community_members (community_id, joined_at, user_id);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
revoke all on public.communities, public.community_members from public, anon, authenticated;
grant select, insert on public.communities to authenticated;
grant select, insert, delete on public.community_members to authenticated;

create policy "Authenticated users can find communities" on public.communities
  for select to authenticated using (true);
create policy "Create your own community" on public.communities
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and (
      photo_url is null or length(photo_url) <= 2048 and
      photo_url ~ ('^https?://[^/?#]+/storage/v1/object/public/post-media/' ||
        owner_id || '/' || id || '-[0-9a-f-]{36}[.]jpg$')
    )
  );
create policy "Authenticated users can see community members" on public.community_members
  for select to authenticated using (true);
create policy "Join a community as yourself" on public.community_members
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.communities c where c.id = community_id and c.owner_id <> (select auth.uid())
    )
  );
create policy "Leave a community as yourself" on public.community_members
  for delete to authenticated using (user_id = (select auth.uid()));

create function public.create_community(
  draft_id uuid, community_name text, community_bio text, community_category text, cover_url text
)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved_cover text;
begin
  insert into public.communities (id, owner_id, name, bio, category, photo_url)
    values (draft_id, actor, trim(community_name), coalesce(trim(community_bio), ''), trim(community_category), cover_url)
    on conflict (id) do nothing;
  select c.photo_url into saved_cover from public.communities c where c.id = draft_id and c.owner_id = actor;
  if not found then raise exception 'Community unavailable'; end if;
  return saved_cover;
end
$$;

create function public.publish_social_post(
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
    if activity_minutes is null or activity_minutes not between 1 and 1440 or
      activity_name is null or length(trim(activity_name)) not between 1 and 80
    then
      raise exception 'Invalid activity';
    end if;
    session_id := draft_id;
    insert into public.workouts (id, user_id, name, started_at, ended_at, activity_category, distance_km, photo_url, photo_urls)
      values (session_id, actor, trim(activity_name), finished_at - make_interval(mins => activity_minutes),
        finished_at, trim(activity_category), activity_distance, selected_photos[1], selected_photos);
  elsif nullif(trim(post_caption), '') is null and cardinality(selected_photos) = 0 then
    raise exception 'Empty post';
  end if;

  insert into public.posts (id, user_id, workout_id, caption, photo_url, photo_urls, discoverable)
    values (draft_id, actor, session_id, nullif(trim(post_caption), ''), selected_photos[1], selected_photos, coalesce(explore, false));
  return selected_photos;
end
$$;

revoke execute on function public.create_community(uuid, text, text, text, text),
  public.publish_social_post(uuid, text, text[], boolean, text, text, integer, numeric) from public, anon;
grant execute on function public.create_community(uuid, text, text, text, text),
  public.publish_social_post(uuid, text, text[], boolean, text, text, integer, numeric) to authenticated;
