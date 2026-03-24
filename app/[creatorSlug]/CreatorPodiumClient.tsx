'use client';

// CreatorPodiumClient.tsx — Client wrapper with realtime subscriptions.
//
// REALTIME: Subscribes to `bids` table INSERTs for this creator.
// On any new bid, re-fetches top 10 by amount_paid and re-renders.
// This triggers all the cascading animations in Podium/Leaderboard.

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabaseBrowser } from '@/lib/supabase-browser';
import Podium from '@/components/Podium';
import Leaderboard from '@/components/Leaderboard';
import BidButton from '@/components/BidButton';
import type { Creator, Bid } from '@/types';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface Props {
  creator: Creator;
  initialBids: Bid[];
}

export default function CreatorPodiumClient({ creator, initialBids }: Props) {
  const [bids, setBids] = useState<Bid[]>(initialBids);
  const [newBidFlash, setNewBidFlash] = useState(false);
  const [minBidDollars, setMinBidDollars] = useState(creator.min_bid_dollars ?? 5);
  const [maxBidDollars, setMaxBidDollars] = useState(creator.max_bid_dollars ?? 50);

  useEffect(() => {
    console.log('[podium-client] Mounted. initialBids length:', initialBids.length);
    console.log('[podium-client] creator:', creator.id, 'slug:', creator.slug);
  }, [creator.id, creator.slug, initialBids.length]);

  // Re-fetch bids via server API route (uses supabaseAdmin to bypass RLS)
  const fetchBids = useCallback(async () => {
    console.log('[podium-client] Re-fetching bids for creator:', creator.id);
    const res = await fetch(`/api/podium/bids?creator_id=${creator.id}`);
    if (!res.ok) {
      console.error('[podium-client] fetchBids failed:', res.status);
      return;
    }
    const body = await res.json() as { bids?: Bid[]; minBidDollars?: number; maxBidDollars?: number };
    if (body.bids) {
      console.log('[podium-client] Fetched', body.bids.length, 'bids');
      setBids(body.bids);
      setNewBidFlash(true);
      setTimeout(() => setNewBidFlash(false), 600);
    }
    if (body.minBidDollars !== undefined) setMinBidDollars(body.minBidDollars);
    if (body.maxBidDollars !== undefined) setMaxBidDollars(body.maxBidDollars);
  }, [creator.id]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`bids:creator:${creator.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `creator_id=eq.${creator.id}`,
        },
        (_payload: RealtimePostgresInsertPayload<Bid>) => { fetchBids(); }
      )
      .subscribe();

    return () => { supabaseBrowser.removeChannel(channel); };
  }, [creator.id, fetchBids]);

  const allSlots: (Bid | null)[] = Array.from({ length: 10 }, (_, i) => bids[i] ?? null);
  const podiumSpots = allSlots.slice(0, 3);
  const leaderboardSpots = allSlots.slice(3);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background grid */}
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      {/* Full-screen flash on new bid via realtime */}
      <AnimatePresence>
        {newBidFlash && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center 40%, rgba(79,70,229,0.12) 0%, transparent 60%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.2, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Creator Header */}
      <motion.div
        className="pt-10 pb-6 text-center relative z-10 px-4"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight break-words">
          {creator.slug}&apos;s
          <span className="bg-gradient-to-r from-yellow-400 via-primary to-secondary bg-clip-text text-transparent ml-2">
            Ego Podium
          </span>
        </h1>
        <p className="text-sm text-muted mt-2 max-w-xs mx-auto">
          Pay to claim your spot. Outbid anyone to take the throne. No refunds.
        </p>
      </motion.div>

      {/* Podium — top 3 */}
      <Podium spots={podiumSpots} onBid={() => {}} />

      {/* Leaderboard — spots 4–10 */}
      <Leaderboard spots={leaderboardSpots} onBid={() => {}} />

      {/* Bid Panel */}
      <BidButton
        creatorSlug={creator.slug}
        currentSpots={allSlots}
        minBidDollars={minBidDollars}
        maxBidDollars={maxBidDollars}
      />

      {/* Live indicator */}
      <motion.div
        className="flex items-center justify-center gap-2 pb-10 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.span
          className="w-2.5 h-2.5 rounded-full bg-green-500"
          animate={{
            scale: [1, 1.3, 1],
            boxShadow: [
              '0 0 0 0 rgba(34,197,94,0.4)',
              '0 0 0 6px rgba(34,197,94,0)',
              '0 0 0 0 rgba(34,197,94,0.4)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-xs text-muted font-medium tracking-wide">LIVE</span>
      </motion.div>
    </div>
  );
}
