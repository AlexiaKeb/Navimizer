// Fonction serveur Supabase : calcule l'ordre optimal d'une tournée.
// Déploiement : supabase functions deploy optimize
// Secrets optionnels (serveurs OSRM dédiés) : OSRM_URL_CAR, OSRM_URL_BIKE, OSRM_URL_FOOT
// Le JWT de l'utilisateur est vérifié par Supabase (verify_jwt activé par défaut).

import { optimizeRoute, OptimizeError, PUBLIC_SERVERS, validateRequest } from '../_shared/optimize.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const servers = {
  car: Deno.env.get('OSRM_URL_CAR') ?? PUBLIC_SERVERS.car,
  bike: Deno.env.get('OSRM_URL_BIKE') ?? PUBLIC_SERVERS.bike,
  walk: Deno.env.get('OSRM_URL_FOOT') ?? PUBLIC_SERVERS.walk,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ code: 'invalid', message: 'Méthode non autorisée' }, 405);

  try {
    const body = validateRequest(await req.json().catch(() => null));
    return json(await optimizeRoute(body, servers, req.signal));
  } catch (e) {
    if (e instanceof OptimizeError) {
      const status = e.code === 'invalid' ? 400 : e.code === 'no_route' ? 422 : 502;
      return json({ code: e.code, message: e.message }, status);
    }
    console.error(e);
    return json({ code: 'upstream', message: 'Erreur interne' }, 500);
  }
});
