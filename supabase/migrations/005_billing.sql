-- Abonnements Stripe. Seul le webhook (clé service) écrit ; l'utilisateur ne peut que lire sa propre ligne.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'none',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
-- Aucune politique d'écriture : impossible de s'attribuer un abonnement depuis le navigateur.

-- Plan Pro = abonnement actif, en essai, ou en retard de paiement (Stripe relance avant de résilier).
create or replace function public.is_pro()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid() and status in ('active', 'trialing', 'past_due')
  );
$$;

revoke all on function public.is_pro() from public, anon;
grant execute on function public.is_pro() to authenticated;

-- Le partage par lien est une fonctionnalité Pro, appliquée côté base.
drop policy "shared_routes_insert_own" on public.shared_routes;
create policy "shared_routes_insert_own" on public.shared_routes
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_pro()));
