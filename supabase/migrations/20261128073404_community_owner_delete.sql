grant delete on public.communities to authenticated;

create policy "Owners can delete their own community"
  on public.communities for delete to authenticated
  using (owner_id = (select auth.uid()));
