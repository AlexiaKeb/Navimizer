// Ouvre le portail client Stripe (changer de carte, voir les factures, résilier) pour l'utilisateur connecté.
// Secrets : STRIPE_SECRET_KEY, SITE_URL. Le portail doit être activé dans le tableau de bord Stripe.

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ code: 'invalid' }, 405);

  const key = Deno.env.get('STRIPE_SECRET_KEY');
  const site = Deno.env.get('SITE_URL')?.replace(/\/+$/, '');
  if (!key || !site) return json({ code: 'not_configured', message: 'Paiement non activé' }, 501);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth?.user) return json({ code: 'unauthorized' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: row } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', auth.user.id).maybeSingle();
    if (!row?.stripe_customer_id) return json({ code: 'no_customer', message: 'Aucun abonnement' }, 404);

    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
    const session = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: `${site}/app` });
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ code: 'upstream', message: 'Portail indisponible' }, 502);
  }
});
