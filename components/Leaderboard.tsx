'use client';

// Leaderboard.tsx — spots #4 through #10, displayed as a ranked list.
//
// BIDDING WAR: When someone outbids the #10 holder, they get knocked off
// with a dramatic exit animation — shake → slide right → fade out.
// Position changes trigger spring physics on every row.
// Amount changes show smooth count-up animation.

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { Bid } from '@/types';

interface LeaderboardProps {
  spots: (Bid | null)[];
  onBid: (currentAmount: number) => void;
}

// ---- Smooth count-up for dollar amounts ----
function AnimatedAmount({ cents }: { cents: number }) {
  const [display, setDisplay] = useState(cents);
  const prevRef = useRef(cents);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = cents;
    if (prev === cents) return;

    const diff = cents - prev;
    const steps = 16;
    const stepSize = diff / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setDisplay(Math.round(prev + stepSize * step));
      if (step >= steps) { setDisplay(cents); clearInterval(interval); }
    }, 30);

    return () => clearInterval(interval);
  }, [cents]);

  return <>${(display / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}</>;
}

// ---- Leaderboard Row with spring physics + outbid shake ----
function LeaderboardRow({ bid, rank, isNew }: { bid: Bid | null; rank: number; isNew: boolean }) {
  const shakeControls = useAnimation();

  // Flash + shake when this row gets a new occupant
  useEffect(() => {
    if (isNew && bid) {
      // Only animate transform (x) — GPU-accelerated. backgroundColor removed (non-GPU).
      shakeControls.start({
        x: [0, -4, 4, -3, 3, -1, 1, 0],
        transition: { duration: 0.5 },
      });
    }
  }, [bid?.id, isNew, shakeControls]);

  return (
    <motion.div
      layout
      animate={shakeControls}
      initial={{ opacity: 0, x: -40, scale: 0.95 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      exit={{
        opacity: 0,
        x: 80,
        scale: 0.85,
        filter: 'blur(4px)',
        transition: { duration: 0.4, ease: 'easeIn' },
      }}
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 28 },
        type: 'spring',
        stiffness: 250,
        damping: 22,
      }}
      viewport={{ once: true }}
      className="flex items-center gap-3 py-3 px-4 rounded-xl bg-surface/60 border border-border/50
                 hover:border-primary/30 hover:bg-surface/80 transition-all group cursor-default"
    >
      {/* Position Badge */}
      <motion.div
        className="flex-shrink-0 w-8 h-8 rounded-lg bg-background flex items-center justify-center
                    border border-border group-hover:border-primary/40 transition-colors relative overflow-hidden"
        whileHover={{ scale: 1.15 }}
      >
        <span className="text-sm font-extrabold text-muted group-hover:text-primary transition-colors relative z-10">
          {rank}
        </span>
        {/* Subtle rank glow on hover */}
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
      </motion.div>

      {/* Avatar */}
      <motion.div
        className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-background border border-border relative"
        whileHover={{ scale: 1.1, borderColor: '#4F46E5' }}
      >
        {bid?.fan_avatar_url ? (
          <Image
            src={bid.fan_avatar_url}
            alt={bid.fan_handle}
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm font-bold">
            {bid ? bid.fan_handle.charAt(0).toUpperCase() : '?'}
          </div>
        )}
      </motion.div>

      {/* Handle + Message */}
      <div className="flex-1 min-w-0">
        {bid ? (
          <>
            <span className="text-sm font-bold text-text-main block truncate">
              {bid.fan_handle}
            </span>
            {bid.message && (
              <p className="text-xs text-muted truncate italic mt-0.5">
                &ldquo;{bid.message}&rdquo;
              </p>
            )}
          </>
        ) : (
          <span className="text-sm text-muted/60">Empty spot — bid to claim!</span>
        )}
      </div>

      {/* Amount with count-up */}
      <div className="flex-shrink-0 text-right">
        {bid ? (
          <motion.span
            key={bid.id}
            className="text-sm font-extrabold text-primary"
            initial={{ scale: 1.4, color: '#059669' }}
            animate={{ scale: 1, color: '#4F46E5' }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          >
            <AnimatedAmount cents={bid.amount_paid} />
          </motion.span>
        ) : (
          <span className="text-sm text-muted/40">--</span>
        )}
      </div>
    </motion.div>
  );
}

export default function Leaderboard({ spots, onBid }: LeaderboardProps) {
  // Track previous bid IDs to detect changes for shake animation
  const prevIdsRef = useRef<(string | null)[]>(Array(7).fill(null));

  const prevIds = prevIdsRef.current;

  useEffect(() => {
    prevIdsRef.current = spots.map((s) => s?.id ?? null);
  }, [spots]);

  return (
    <div className="w-full max-w-lg mx-auto px-4 mt-8">
      <motion.h3
        className="text-xs font-extrabold text-muted tracking-[0.2em] mb-4 px-1"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        LEADERBOARD
      </motion.h3>
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: 7 }, (_, i) => {
            const rank = i + 4;
            const bid = spots[i] ?? null;
            const isNew = bid !== null && (bid.id !== prevIds[i]);
            return (
              <LeaderboardRow
                key={bid?.id ?? `empty-${rank}`}
                bid={bid}
                rank={rank}
                isNew={isNew}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
