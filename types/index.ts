// Core types for The Creator Podium bidding system.
//
// BIDDING WAR LOGIC:
// - The podium has 10 spots. Spots 1-3 are displayed prominently on the Podium.
// - Spots 4-10 are shown on the Leaderboard.
// - Fans enter a FREE AMOUNT — the system auto-places them by rank.
// - Highest bid = #1, lowest on-board bid = #10.
// - Minimum entry is always $5, or (current #10 amount + $1) if the board is full.
// - The displaced fan (knocked off #10) loses their spot with NO REFUND.

export interface Creator {
  id: string;
  slug: string;
  stripe_account_id: string | null;
  plan_type: string;
  created_at: string;
}

export interface PodiumSpot {
  id: string;
  creator_id: string;
  position: number;
  fan_handle: string;
  fan_avatar_url: string | null;
  message: string | null;
  amount_paid: number;
  stripe_payment_intent_id: string;
  created_at: string;
}

export interface Bid {
  id: string;
  creator_id: string;
  fan_handle: string;
  fan_avatar_url: string | null;
  message: string | null;
  amount_paid: number;
  stripe_payment_intent_id: string;
  created_at: string;
}

// Payload sent from the BidButton to /api/checkout.
// Fan enters a free amount — position is computed server-side by ranking all bids.
export interface CheckoutPayload {
  creatorSlug: string;
  amountCents: number; // The fan's bid in cents
  fanHandle: string;
  fanAvatarUrl?: string;
  message?: string;
}

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export interface CheckoutMetadata {
  creator_id: string;
  fan_handle: string;
  fan_avatar_url: string;
  message: string;
  amount_cents: string;
}
