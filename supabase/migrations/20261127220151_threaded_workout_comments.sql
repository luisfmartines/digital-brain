alter table public.post_comments
  add column parent_id uuid,
  add constraint post_comments_id_post_key unique (id, post_id),
  add constraint post_comments_same_post_parent foreign key (parent_id, post_id)
    references public.post_comments (id, post_id) on delete set null (parent_id);

create index post_comments_thread_order_idx on public.post_comments (post_id, created_at, id);
create index post_comments_parent_idx on public.post_comments (parent_id) where parent_id is not null;

create policy "Comment only on visible posts" on public.post_comments
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.posts p where p.id = post_comments.post_id and p.deleted_at is null
  ));

create function public.check_workout_comment_parent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.parent_id is not null and (new.parent_id = new.id or not exists (
    select 1 from public.post_comments c where c.id = new.parent_id and c.post_id = new.post_id
  )) then
    raise exception 'Comment is unavailable';
  end if;
  return new;
end
$$;

create trigger check_workout_comment_parent before insert on public.post_comments
  for each row execute function public.check_workout_comment_parent();
revoke execute on function public.check_workout_comment_parent() from public, anon, authenticated;

create table public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (comment_id, user_id)
);

create index post_comment_likes_user_idx on public.post_comment_likes (user_id);
alter table public.post_comment_likes enable row level security;
revoke all on public.post_comment_likes from public, anon, authenticated;
grant select, insert, delete on public.post_comment_likes to authenticated;

create policy "Read likes on visible comments" on public.post_comment_likes
  for select to authenticated
  using (exists (
    select 1 from public.post_comments c join public.posts p on p.id = c.post_id
    where c.id = post_comment_likes.comment_id and p.deleted_at is null
  ));

create policy "Like visible comments as yourself" on public.post_comment_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.post_comments c join public.posts p on p.id = c.post_id
    where c.id = post_comment_likes.comment_id and p.deleted_at is null
  ));

create policy "Remove your comment likes" on public.post_comment_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));
