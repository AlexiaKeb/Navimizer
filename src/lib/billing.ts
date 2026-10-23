import { FunctionsHttpError } from '@supabase/supabase-js';
import { isBackendConfigured, supabase } from './supabase';

export type BillingErrorCode = 'not_configured' | 'already_pro' | 'no_customer' | 'failed';

const MESSAGES: Record<BillingErrorCode, string> = {
  not_configured: "Le paiement n'est pas encore activé sur ce site.",
  already_pro: 'Votre abonnement Pro est déjà actif.',
  no_customer: "Aucun abonnement à gérer pour ce compte.",
  failed: 'Le service de paiement est indisponible. Réessayez dans un instant.',
};

export class BillingError extends Error {
  constructor(public code: BillingErrorCode) {
    super(MESSAGES[code]);
  }
}

/** Appelle une fonction serveur qui renvoie une adresse Stripe, puis y redirige le navigateur. */
async function redirectToStripe(fn: 'create-checkout' | 'customer-portal'): Promise<void> {
  if (!isBackendConfigured) throw new BillingError('not_configured');
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(fn);
  if (!error && data?.url) {
    window.location.assign(data.url);
    return;
  }
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    if (status === 501 || status === 404 && fn === 'create-checkout') throw new BillingError('not_configured');
    if (status === 409) throw new BillingError('already_pro');
    if (status === 404) throw new BillingError('no_customer');
  }
  throw new BillingError('failed');
}

export const startCheckout = () => redirectToStripe('create-checkout');
export const openBillingPortal = () => redirectToStripe('customer-portal');
