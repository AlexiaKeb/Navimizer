-- Évalue auth.uid() une seule fois par requête au lieu d'une fois par ligne (recommandation de l'analyse de performance Supabase).
alter policy "routes_select_own" on public.routes using ((select auth.uid()) = user_id);
alter policy "routes_insert_own" on public.routes with check ((select auth.uid()) = user_id);
alter policy "routes_update_own" on public.routes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "routes_delete_own" on public.routes using ((select auth.uid()) = user_id);

alter policy "shared_routes_select_own" on public.shared_routes using ((select auth.uid()) = user_id);
alter policy "shared_routes_insert_own" on public.shared_routes with check ((select auth.uid()) = user_id);
alter policy "shared_routes_delete_own" on public.shared_routes using ((select auth.uid()) = user_id);
