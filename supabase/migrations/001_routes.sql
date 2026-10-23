create table public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  origin text not null,
  destination text not null,
  waypoints jsonb not null default '[]'::jsonb,
  mode text not null check (mode in ('car', 'bike', 'walk')),
  distance integer not null,
  duration integer not null,
  created_at timestamptz not null default now()
);

create index routes_user_created_idx on public.routes (user_id, created_at desc);

alter table public.routes enable row level security;

create policy "routes_select_own" on public.routes
  for select to authenticated using (auth.uid() = user_id);
create policy "routes_insert_own" on public.routes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "routes_update_own" on public.routes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routes_delete_own" on public.routes
  for delete to authenticated using (auth.uid() = user_id);
