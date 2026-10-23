// Logique d'abonnement partagée (pure, testable) : limites des plans et traitement des événements Stripe.

/** Arrêts maximum par tournée pour le plan gratuit (le plan Pro va jusqu'à MAX_POINTS). */
export const FREE_MAX_POINTS = 10;

/** Statuts Stripe qui donnent accès au plan Pro (past_due : Stripe relance le paiement avant de résilier). */
export const PRO_STATUSES = ['active', 'trialing', 'past_due'];
export const isProStatus = (status?: string | null): boolean => !!status && PRO_STATUSES.includes(status);

export interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

// Forme minimale d'un abonnement Stripe (champs variables selon la version d'API : on lit les deux emplacements).
export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  items?: { data?: { price?: { id?: string } | null; current_period_end?: number | null }[] } | null;
}

const customerId = (c: StripeSubscriptionLike['customer']) => (typeof c === 'string' ? c : c?.id ?? null);

export function mapSubscription(sub: StripeSubscriptionLike, userId: string, now = new Date()): SubscriptionRow {
  const item = sub.items?.data?.[0];
  const end = sub.current_period_end ?? item?.current_period_end ?? null;
  return {
    user_id: userId,
    stripe_customer_id: customerId(sub.customer),
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: item?.price?.id ?? null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    updated_at: now.toISOString(),
  };
}

export interface BillingDeps {
  /** Relit l'abonnement chez Stripe (source de vérité : l'ordre d'arrivée des événements n'a pas d'importance). */
  getSubscription(id: string): Promise<StripeSubscriptionLike>;
  findUserByCustomer(customerId: string): Promise<string | null>;
  upsert(row: SubscriptionRow): Promise<void>;
}

export interface StripeEventLike {
  type: string;
  // deno-lint-ignore no-explicit-any
  data: { object: any };
}

export type EventOutcome = 'updated' | 'ignored' | 'no_user';

const SUBSCRIPTION_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
];
const INVOICE_EVENTS = ['invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required'];

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : null;

function subscriptionIdFromEvent(event: StripeEventLike): { id: string | null; userHint: string | null } {
  const o = event.data.object;
  if (SUBSCRIPTION_EVENTS.includes(event.type)) return { id: o.id ?? null, userHint: null };
  if (event.type === 'checkout.session.completed')
    return { id: o.mode === 'subscription' ? idOf(o.subscription) : null, userHint: o.client_reference_id ?? null };
  if (INVOICE_EVENTS.includes(event.type))
    return { id: idOf(o.subscription) ?? idOf(o.parent?.subscription_details?.subscription), userHint: null };
  return { id: null, userHint: null };
}

export async function handleStripeEvent(event: StripeEventLike, deps: BillingDeps): Promise<EventOutcome> {
  const { id, userHint } = subscriptionIdFromEvent(event);
  if (!id) return 'ignored';

  const sub = await deps.getSubscription(id);
  const cust = customerId(sub.customer);
  const userId = sub.metadata?.user_id || userHint || (cust ? await deps.findUserByCustomer(cust) : null);
  if (!userId) return 'no_user';

  await deps.upsert(mapSubscription(sub, userId));
  return 'updated';
}
