-- Vínculo entre um exercício do app e o exercício correspondente na ExerciseDB (vídeo/GIF e instruções)
create table if not exists public.exercise_media_links (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null,
  external_id text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.exercise_media_links enable row level security;

grant select, insert, update, delete on public.exercise_media_links to authenticated;

drop policy if exists "links: ler os próprios" on public.exercise_media_links;
drop policy if exists "links: criar os próprios" on public.exercise_media_links;
drop policy if exists "links: atualizar os próprios" on public.exercise_media_links;
drop policy if exists "links: apagar os próprios" on public.exercise_media_links;

create policy "links: ler os próprios" on public.exercise_media_links
  for select to authenticated using (user_id = (select auth.uid()));
create policy "links: criar os próprios" on public.exercise_media_links
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "links: atualizar os próprios" on public.exercise_media_links
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "links: apagar os próprios" on public.exercise_media_links
  for delete to authenticated using (user_id = (select auth.uid()));
