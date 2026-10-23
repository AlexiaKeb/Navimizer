import { describe, expect, it } from 'vitest';
import {
  FREE_MAX_POINTS,
  handleStripeEvent,
  isProStatus,
  mapSubscription,
  type BillingDeps,
  type StripeSubscriptionLike,
  type SubscriptionRow,
} from '../supabase/functions/_shared/billing.ts';

const sub = (over: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike => ({
  id: 'sub_1',
  status: 'active',
  customer: 'cus_1',
  metadata: { user_id: 'user-1' },
  cancel_at_period_end: false,
  current_period_end: 1_800_000_000,
  items: { data: [{ price: { id: 'price_pro' } }] },
  ...over,
});

function deps(current: StripeSubscriptionLike, users: Record<string, string> = {}) {
  const rows: SubscriptionRow[] = [];
  const calls: string[] = [];
  const d: BillingDeps = {
    getSubscription: async (id) => (calls.push(`get:${id}`), current),
    findUserByCustomer: async (c) => (calls.push(`find:${c}`), users[c] ?? null),
    upsert: async (row) => void rows.push(row),
  };
  return { d, rows, calls };
}

describe('plans', () => {
  it('le plan gratuit est limité à 10 arrêts', () => expect(FREE_MAX_POINTS).toBe(10));

  it.each([
    ['active', true], ['trialing', true], ['past_due', true],
    ['canceled', false], ['unpaid', false], ['incomplete', false], ['incomplete_expired', false], ['paused', false], ['none', false],
    [undefined, false], [null, false], ['', false],
  ])('isProStatus(%s) = %s', (s, expected) => expect(isProStatus(s as string)).toBe(expected));
});

describe('mapSubscription', () => {
  it('convertit un abonnement Stripe en ligne de base de données', () => {
    const row = mapSubscription(sub({ cancel_at_period_end: true }), 'user-1', new Date('2026-10-23T12:00:00Z'));
    expect(row).toEqual({
      user_id: 'user-1',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      status: 'active',
      price_id: 'price_pro',
      current_period_end: '2027-01-15T08:00:00.000Z',
      cancel_at_period_end: true,
      updated_at: '2026-10-23T12:00:00.000Z',
    });
  });

  it("lit la fin de période sur l'article (versions récentes de l'API) et un client détaillé", () => {
    const row = mapSubscription(
      sub({ current_period_end: undefined, customer: { id: 'cus_9' }, items: { data: [{ price: { id: 'p' }, current_period_end: 1_900_000_000 }] } }),
      'u',
    );
    expect(row.stripe_customer_id).toBe('cus_9');
    expect(row.current_period_end).toBe(new Date(1_900_000_000 * 1000).toISOString());
  });

  it('tolère les champs absents', () => {
    const row = mapSubscription({ id: 's', status: 'canceled', customer: null }, 'u');
    expect(row).toMatchObject({ stripe_customer_id: null, price_id: null, current_period_end: null, cancel_at_period_end: false });
  });
});

describe('handleStripeEvent', () => {
  const ev = (type: string, object: unknown) => ({ type, data: { object } });

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
  ])("%s : relit l'abonnement chez Stripe et enregistre son état", async (type) => {
    const { d, rows, calls } = deps(sub({ status: type.endsWith('deleted') ? 'canceled' : 'active' }));
    expect(await handleStripeEvent(ev(type, { id: 'sub_1', status: 'CONTENU PÉRIMÉ' }), d)).toBe('updated');
    expect(calls).toEqual(['get:sub_1']);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(type.endsWith('deleted') ? 'canceled' : 'active'); // jamais l'état du payload
  });

  it("checkout.session.completed : utilise l'abonnement de la session et l'identifiant utilisateur de la session", async () => {
    const { d, rows } = deps(sub({ metadata: {} }));
    const out = await handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'user-7' }), d);
    expect(out).toBe('updated');
    expect(rows[0].user_id).toBe('user-7');
  });

  it('checkout.session.completed hors abonnement : ignoré', async () => {
    const { d, rows } = deps(sub());
    expect(await handleStripeEvent(ev('checkout.session.completed', { mode: 'payment', subscription: null }), d)).toBe('ignored');
    expect(rows).toHaveLength(0);
  });

  it.each([
    ['invoice.paid', { subscription: 'sub_1' }],
    ['invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_1' } } }],
  ])('%s : retrouve l\'abonnement dans les deux formats de facture', async (type, obj) => {
    const { d, rows } = deps(sub({ status: 'past_due' }));
    expect(await handleStripeEvent(ev(type, obj), d)).toBe('updated');
    expect(rows[0].status).toBe('past_due');
  });

  it("retrouve l'utilisateur par le client Stripe quand les métadonnées manquent", async () => {
    const { d, rows } = deps(sub({ metadata: null }), { cus_1: 'user-from-db' });
    expect(await handleStripeEvent(ev('customer.subscription.updated', { id: 'sub_1' }), d)).toBe('updated');
    expect(rows[0].user_id).toBe('user-from-db');
  });

  it('abonnement créé hors de Navimizer (utilisateur introuvable) : rien n\'est écrit', async () => {
    const { d, rows } = deps(sub({ metadata: null }));
    expect(await handleStripeEvent(ev('customer.subscription.created', { id: 'sub_1' }), d)).toBe('no_user');
    expect(rows).toHaveLength(0);
  });

  it('événements sans rapport : ignorés sans appel à Stripe', async () => {
    const { d, calls } = deps(sub());
    expect(await handleStripeEvent(ev('charge.refunded', { id: 'ch_1' }), d)).toBe('ignored');
    expect(calls).toEqual([]);
  });

  it('est idempotent : le même événement rejoué donne le même état', async () => {
    const { d, rows } = deps(sub());
    const e = ev('customer.subscription.updated', { id: 'sub_1' });
    await handleStripeEvent(e, d);
    await handleStripeEvent(e, d);
    expect({ ...rows[0], updated_at: '' }).toEqual({ ...rows[1], updated_at: '' });
  });
});
