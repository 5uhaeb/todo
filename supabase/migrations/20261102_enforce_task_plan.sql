-- Serialize writes per account so concurrent requests cannot exceed the free plan.
begin;
create or replace function public.enforce_task_plan()
returns trigger language plpgsql set search_path = '' as $$
declare account_role text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  select role into account_role from public.profiles where id = new.user_id;
  if new.title is null or length(btrim(new.title)) = 0 or length(btrim(new.title)) > 500 then
    raise exception 'Title must contain 1 to 500 characters' using errcode = '23514';
  end if;
  if new.completed is null or new.priority is null then
    raise exception 'Completed and priority are required' using errcode = '23514';
  end if;
  if coalesce(account_role, 'free') <> 'premium' then
    if new.priority = 'high' then
      raise exception 'High priority is premium only' using errcode = '23514';
    end if;
    if TG_OP = 'INSERT' and (select count(*) from public.todos where user_id = new.user_id) >= 10 then
      raise exception 'Free users can only create 10 tasks' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_task_plan() from public;
drop trigger if exists enforce_task_plan on public.todos;
create trigger enforce_task_plan before insert or update on public.todos
for each row execute function public.enforce_task_plan();
commit;
