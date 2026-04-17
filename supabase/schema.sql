create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text default 'free' check (role in ('free', 'premium')),
  created_at timestamp with time zone default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean default false,
  priority text default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamp with time zone default now()
);

create index if not exists idx_todos_user_id on public.todos(user_id);
create index if not exists idx_todos_completed on public.todos(completed);
create index if not exists idx_todos_priority on public.todos(priority);

alter table public.profiles enable row level security;
alter table public.todos enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id);

create policy "todos_select_own"
on public.todos
for select
using (auth.uid() = user_id);

create policy "todos_insert_own"
on public.todos
for insert
with check (auth.uid() = user_id);

create policy "todos_update_own"
on public.todos
for update
using (auth.uid() = user_id);

create policy "todos_delete_own"
on public.todos
for delete
using (auth.uid() = user_id);
