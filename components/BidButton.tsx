'use client';

// BidButton.tsx — Dynamic bidding panel where fans enter a free amount.
//
// BIDDING WAR LOGIC:
// - Fan enters any dollar amount they want to bid.
// - Minimum entry: $5, or (current #10's amount + $1) if the board is full.
// - The system auto-places the fan at the correct position based on amount rank.
// - Heartbeat pulse animation while user is typing an amount.
// - Flow: validate → /api/moderate → /api/checkout → Stripe redirect.

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Bid, ModerationResult } from '@/types';

const ABSOLUTE_MINIMUM_CENTS = 500;
const MAXIMUM_BID_DOLLARS    = 50; // $50 launch cap

interface BidButtonProps {
  creatorSlug: string;
  currentSpots: (Bid | null)[];
  disabled?: boolean;
}

// ---- Heartbeat pulse ring that activates while typing ----
function HeartbeatRing({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-primary/40"
        animate={{
          scale: [1, 1.02, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(79,70,229,0.06) 0%, transparent 70%)',
        }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function BidButton({ creatorSlug, currentSpots, disabled = false }: BidButtonProps) {
  const [fanHandle, setFanHandle] = useState('');
  const [message, setMessage] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isTypingAmount, setIsTypingAmount] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Minimum bid: max($5, current #10 amount + $1)
  const minimumBidCents = useMemo(() => {
    const occupiedSpots = currentSpots.filter((s): s is Bid => s !== null);
    if (occupiedSpots.length < 10) return ABSOLUTE_MINIMUM_CENTS;
    const lowestBid = occupiedSpots[occupiedSpots.length - 1];
    return Math.max(ABSOLUTE_MINIMUM_CENTS, lowestBid.amount_paid + 100);
  }, [currentSpots]);

  const minimumBidDollars = (minimumBidCents / 100).toFixed(0);

  // Projected position
  const projectedPosition = useMemo(() => {
    const cents = Math.round(parseFloat(amountDollars || '0') * 100);
    if (cents < minimumBidCents) return null;
    const occupiedSpots = currentSpots.filter((s): s is Bid => s !== null);
    const higherCount = occupiedSpots.filter((s) => s.amount_paid >= cents).length;
    return Math.min(higherCount + 1, 10);
  }, [amountDollars, currentSpots, minimumBidCents]);

  const positionLabel = (pos: number) => {
    if (pos === 1) return 'KING';
    if (pos === 2) return 'Runner-up';
    if (pos === 3) return 'Jester';
    return `#${pos}`;
  };

  // Heartbeat: track when user is actively typing the amount
  const handleAmountChange = (val: string) => {
    setAmountDollars(val);
    setIsTypingAmount(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTypingAmount(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Start a 3-second cooldown after any failed bid attempt
  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSeconds(3);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleSubmit = async () => {
    setError(null);
    const cents = Math.round(parseFloat(amountDollars) * 100);

    if (!fanHandle.trim()) { setError('Enter your handle'); startCooldown(); return; }
    if (isNaN(cents) || cents < minimumBidCents) { setError(`Minimum bid is $${minimumBidDollars}`); startCooldown(); return; }
    if (cents > MAXIMUM_BID_DOLLARS * 100) { setError(`Maximum bid is $${MAXIMUM_BID_DOLLARS} during launch`); startCooldown(); return; }

    setLoading(true);
    try {
      if (message.trim()) {
        const modRes = await fetch('/api/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message.trim() }),
        });
        const modData: ModerationResult = await modRes.json();
        if (!modData.allowed) {
          setError(modData.reason || 'Message not allowed');
          setLoading(false);
          startCooldown();
          return;
        }
      }

      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorSlug,
          amountCents: cents,
          fanHandle: fanHandle.trim(),
          message: message.trim() || undefined,
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (checkoutData.url) {
        window.location.href = checkoutData.url;
        // No cooldown on success — user is redirected to Stripe
      } else {
        setError(checkoutData.error || 'Failed to create checkout session');
        startCooldown();
      }
    } catch {
      setError('Something went wrong. Try again.');
      startCooldown();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 mt-10 mb-12">
      {/* Collapsed: CTA button */}
      {!isOpen ? (
        <motion.button
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="w-full py-5 rounded-2xl font-extrabold text-lg text-white relative overflow-hidden
                     bg-gradient-to-r from-primary to-secondary
                     disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{
            scale: 1.02,
            boxShadow: '0 0 40px rgba(79,70,229,0.4), 0 0 80px rgba(124,58,237,0.2)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="relative z-10">
            Claim Your Spot — from ${minimumBidDollars}
          </span>
          {/* Shimmer sweep — GPU-accelerated via transform: translateX */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
          />
        </motion.button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-surface border border-border rounded-2xl p-6 space-y-5 relative"
          >
            {/* Heartbeat ring when typing amount */}
            <HeartbeatRing active={isTypingAmount && !!amountDollars} />

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-text-main tracking-wide">Place Your Bid</h3>
              <motion.button
                onClick={() => { setIsOpen(false); setError(null); }}
                className="text-muted hover:text-text-main transition-colors text-sm px-2 py-1 rounded-lg
                           hover:bg-background"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
            </div>

            {/* Minimum entry info */}
            <div className="bg-background/80 rounded-xl px-4 py-3 border border-primary/20">
              <span className="text-xs text-muted">Minimum entry: </span>
              <motion.span
                className="text-sm font-extrabold text-primary"
                key={minimumBidDollars}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                ${minimumBidDollars}
              </motion.span>
              <span className="text-xs text-muted ml-1.5">
                {currentSpots.filter(Boolean).length >= 10 ? '(outbid #10 + $1)' : '(open spots available)'}
              </span>
              <span className="text-xs text-muted ml-2 opacity-60">
                · max ${MAXIMUM_BID_DOLLARS} during launch
              </span>
            </div>

            {/* Handle */}
            <div>
              <label className="text-xs text-muted mb-1.5 block font-medium tracking-wide">YOUR HANDLE</label>
              <input
                type="text"
                value={fanHandle}
                onChange={(e) => setFanHandle(e.target.value)}
                placeholder="@yourname"
                maxLength={30}
                className="w-full bg-background border border-border rounded-xl px-4 py-3
                           text-text-main placeholder:text-muted/40 text-sm
                           focus:outline-none focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-muted mb-1.5 block font-medium tracking-wide">MESSAGE (OPTIONAL)</label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Shoutout to the creator!"
                maxLength={100}
                className="w-full bg-background border border-border rounded-xl px-4 py-3
                           text-text-main placeholder:text-muted/40 text-sm
                           focus:outline-none focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-muted mb-1.5 block font-medium tracking-wide">YOUR BID (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-xl font-bold">$</span>
                <input
                  type="number"
                  value={amountDollars}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder={minimumBidDollars}
                  min={parseInt(minimumBidDollars)}
                  max={MAXIMUM_BID_DOLLARS}
                  step="1"
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-4
                             text-text-main text-2xl font-extrabold
                             focus:outline-none focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)] transition-all
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                             [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Projected position */}
            <AnimatePresence mode="wait">
              {projectedPosition && (
                <motion.div
                  key={projectedPosition}
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`rounded-xl px-4 py-4 text-center border relative overflow-hidden ${
                    projectedPosition <= 3
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-primary/10 border-primary/30'
                  }`}
                >
                  <span className="text-xs text-muted">You would land at </span>
                  <span className={`text-xl font-extrabold ml-1 ${
                    projectedPosition === 1 ? 'text-yellow-400' : 'text-primary'
                  }`}>
                    {positionLabel(projectedPosition)}
                  </span>
                  {projectedPosition === 1 && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={loading || disabled || cooldownSeconds > 0}
              className="w-full py-4 min-h-[56px] rounded-xl font-extrabold text-white relative overflow-hidden
                         bg-gradient-to-r from-primary to-secondary
                         disabled:opacity-50 disabled:cursor-not-allowed text-base"
              whileHover={cooldownSeconds === 0 ? {
                scale: 1.01,
                boxShadow: '0 0 30px rgba(79,70,229,0.35)',
              } : {}}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  />
                  Processing...
                </span>
              ) : cooldownSeconds > 0 ? (
                <span className="relative z-10 tabular-nums">
                  Try again in {cooldownSeconds}s...
                </span>
              ) : (
                <span className="relative z-10">Pay & Claim Spot</span>
              )}
            </motion.button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
