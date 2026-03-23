import Stripe from 'stripe';

// Default Stripe client using the platform's secret key.
// For per-creator charges, instantiate a new Stripe client with the
// creator's own stripe_secret_key (stored in the `creators` table).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/**
 * Returns a Stripe client scoped to a specific creator's secret key.
 * Each creator controls their own Stripe account so payouts go directly to them.
 */
export function getCreatorStripe(creatorSecretKey: string): Stripe {
  return new Stripe(creatorSecretKey, {
    apiVersion: '2026-02-25.clover',
  });
}
