-- Tournées partagées par lien : lisibles sans compte via un jeton secret, pendant 30 jours.
create table public.shared_routes (
  token text primary key
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  payload jsonb not null check (pg_column_size(payload) < 200000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index shared_routes_user_idx on public.shared_routes (user_id, created_at desc);

alter table public.shared_routes enable row level security;

-- Le propriétaire gère ses liens ; personne ne peut lister les jetons des autres.
create policy "shared_routes_select_own" on public.shared_routes
  for select to authenticated using (auth.uid() = user_id);
create policy "shared_routes_insert_own" on public.shared_routes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "shared_routes_delete_own" on public.shared_routes
  for delete to authenticated using (auth.uid() = user_id);

-- Lecture publique d'une tournée connaissant son jeton (et seulement lui).
create or replace function public.get_shared_route(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select payload from public.shared_routes where token = p_token and expires_at > now();
$$;

revoke all on function public.get_shared_route(text) from public;
grant execute on function public.get_shared_route(text) to anon, authenticated;
