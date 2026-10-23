// Crée une session de paiement Stripe Checkout (abonnement Pro) pour l'utilisateur connecté.
// Secrets : STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO, SITE_URL (ex. https://navimizer.onrender.com)

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isProStatus } from '../_shared/billing.ts';

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
  const price = Deno.env.get('STRIPE_PRICE_ID_PRO');
  const site = Deno.env.get('SITE_URL')?.replace(/\/+$/, '');
  if (!key || !price || !site) return json({ code: 'not_configured', message: 'Paiement non activé' }, 501);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  const user = auth?.user;
  if (authError || !user) return json({ code: 'unauthorized' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: existing } = await admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
    if (existing && isProStatus(existing.status)) return json({ code: 'already_pro', message: 'Abonnement déjà actif' }, 409);

    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

    let customer: string | null = existing?.stripe_customer_id ?? null;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
      customer = created.id;
      const { error } = await admin
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customer, status: 'none' }, { onConflict: 'user_id' });
      if (error) throw error;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } }, // retrouve l'utilisateur à chaque événement Stripe
      allow_promotion_codes: true,
      locale: 'fr',
      success_url: `${site}/app?checkout=success`,
      cancel_url: `${site}/app?checkout=cancel`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ code: 'upstream', message: 'Paiement indisponible' }, 502);
  }
});
