import Stripe from 'stripe';

let _stripe: Stripe | undefined;

// Default Stripe client using the platform's secret key.
// For per-creator charges, instantiate a new Stripe client with the
// creator's own stripe_secret_key (stored in the `creators` table).
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return _stripe;
}

/**
 * Returns a Stripe client scoped to a specific creator's secret key.
 * Each creator controls their own Stripe account so payouts go directly to them.
 */
export function getCreatorStripe(creatorSecretKey: string): Stripe {
  return new Stripe(creatorSecretKey, {
    apiVersion: '2026-02-25.clover',
  });
}

// Backwards-compatible named export (lazy proxy)
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === 'function') return (val as Function).bind(client);
    return val;
  },
});
