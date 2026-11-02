-- Reads remain scoped by the existing owner RLS policies. All writes go
-- through the authenticated API, which enforces plan and payment rules.
begin;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.todos from anon, authenticated;
grant select on public.profiles, public.todos to authenticated;
grant all on public.profiles, public.todos to service_role;
commit;
