// Webhook Stripe : tient la table `subscriptions` à jour. Déployé SANS vérification JWT (Stripe n'en envoie pas) ;
// l'authenticité est garantie par la signature Stripe.
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Événements à activer sur l'endpoint Stripe : checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleStripeEvent } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const key = Deno.env.get('STRIPE_SECRET_KEY');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!key || !secret) return new Response('Not configured', { status: 501 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (e) {
    console.error('Signature invalide', e);
    return new Response('Invalid signature', { status: 400 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const outcome = await handleStripeEvent(event, {
      getSubscription: (id) => stripe.subscriptions.retrieve(id),
      findUserByCustomer: async (customer) => {
        const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customer).maybeSingle();
        return data?.user_id ?? null;
      },
      upsert: async (row) => {
        const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' });
        if (error) throw error;
      },
    });
    if (outcome === 'no_user') console.warn('Événement sans utilisateur associé', event.type, event.id);
    return new Response(JSON.stringify({ received: true, outcome }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response('Handler error', { status: 500 }); // Stripe réessaiera
  }
});
