"use client";

// BidAction.tsx — Animation 9: The Radioactive Dopamine Button
//
// Two visual modes driven by the typed amount vs. current King:
//
//   STANDARD MODE (amount ≤ king):
//     • Premium dark card, white glow shadow
//     • Button: indigo-to-violet gradient, "Claim Your Spot"
//
//   RADIOACTIVE MODE (amount > king):
//     • Border pulses fiery gold ↔ red
//     • Outer glow: shadow-[0_0_25px_rgba(255,0,0,0.8)]
//     • Button continuously scales up/down (heartbeat pulse)
//     • Button text: "👑 STEAL THE CROWN"
//
// Always visible helper texts:
//   "Minimum entry: $X"    (spot10 + $1, or $5 floor)
//   "To steal Crown: $Y"   (currentKingAmount / 100 + 1)
//
// Submit flow: /api/moderate → inline error if flagged → /api/checkout → Stripe

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BidActionProps {
  /** Amount in cents for the current #1 spot (0 if throne is empty) */
  currentKingAmount: number;
  /** Amount in cents for the current #10 spot (0 if fewer than 10 bids) */
  currentSpot10Amount: number;
  creatorSlug: string;
}

export default function BidAction({
  currentKingAmount,
  currentSpot10Amount,
  creatorSlug,
}: BidActionProps) {
  const MAXIMUM_BID_DOLLARS = 50; // $50 launch cap

  const [fanHandle, setFanHandle] = useState("");
  const [message, setMessage] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

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

  // ── Derived values ──────────────────────────────────────────
  const amountCents = useMemo(() => {
    const parsed = parseFloat(amountDollars);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [amountDollars]);

  // Minimum: $5 floor, or #10 spot + $1 if board is full
  const minimumCents = Math.max(500, currentSpot10Amount > 0 ? currentSpot10Amount + 100 : 500);
  const minimumDollars = Math.floor(minimumCents / 100);

  // Amount needed to steal the crown ($1 more than king, or $5 if throne is empty)
  const stealCrownDollars =
    currentKingAmount > 0 ? Math.floor(currentKingAmount / 100) + 1 : 5;

  // RADIOACTIVE: typed amount beats the king
  const isRadioactive = currentKingAmount > 0 && amountCents > currentKingAmount;

  // ── Submit flow ─────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    if (!fanHandle.trim()) {
      setError("Enter your handle");
      startCooldown();
      return;
    }
    if (amountCents < minimumCents) {
      setError(`Minimum bid is $${minimumDollars}`);
      startCooldown();
      return;
    }
    if (amountCents > MAXIMUM_BID_DOLLARS * 100) {
      setError(`Maximum bid is $${MAXIMUM_BID_DOLLARS} during launch`);
      startCooldown();
      return;
    }

    setLoading(true);
    try {
      // Step 1: moderate message
      if (message.trim()) {
        const modRes = await fetch("/api/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message.trim() }),
        });
        const modData = await modRes.json();
        if (!modData.allowed) {
          setError("Message not allowed ❌");
          setLoading(false);
          startCooldown();
          return;
        }
      }

      // Step 2: create Stripe checkout session
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorSlug,
          amountCents,
          fanHandle: fanHandle.trim(),
          message: message.trim() || undefined,
        }),
      });

      const data = await checkoutRes.json();
      if (data.url) {
        window.location.href = data.url;
        // No cooldown on success — user is redirected to Stripe
      } else {
        setError(data.error || "Failed to create checkout session");
        startCooldown();
      }
    } catch {
      setError("Something went wrong. Try again.");
      startCooldown();
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input className ──────────────────────────────────
  const inputClass =
    "w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 " +
    "placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/70 " +
    "focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";

  return (
    <div className="w-full max-w-lg mx-auto px-4 mt-10 mb-14">
      {/* ── Card wrapper — pulses in radioactive mode ── */}
      <motion.div
        className="rounded-2xl p-6 space-y-5 border-2"
        animate={
          isRadioactive
            ? {
                borderColor: [
                  "rgba(249,115,22,0.9)",
                  "rgba(239,68,68,0.9)",
                  "rgba(234,179,8,0.9)",
                  "rgba(239,68,68,0.9)",
                  "rgba(249,115,22,0.9)",
                ],
                boxShadow: [
                  "0 0 20px rgba(255,80,0,0.5), inset 0 0 20px rgba(255,80,0,0.05)",
                  "0 0 40px rgba(255,0,0,0.8), inset 0 0 30px rgba(255,0,0,0.08)",
                  "0 0 30px rgba(255,180,0,0.6), inset 0 0 20px rgba(255,180,0,0.06)",
                  "0 0 40px rgba(255,0,0,0.8), inset 0 0 30px rgba(255,0,0,0.08)",
                  "0 0 20px rgba(255,80,0,0.5), inset 0 0 20px rgba(255,80,0,0.05)",
                ],
                backgroundColor: "rgba(10, 6, 2, 1)",
              }
            : {
                borderColor: "rgba(51,65,85,1)",
                boxShadow: "0 0 10px rgba(255,255,255,0.2)",
                backgroundColor: "rgba(15,23,42,0.85)",
              }
        }
        transition={
          isRadioactive
            ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }
        }
      >
        {/* ── Helper text row ── */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Minimum entry:{" "}
            <span className="text-slate-200 font-bold">${minimumDollars}</span>
            <span className="opacity-50 ml-1">· max ${MAXIMUM_BID_DOLLARS}</span>
          </span>
          <span className="text-slate-500">
            Steal crown:{" "}
            <motion.span
              className="font-bold"
              animate={
                isRadioactive
                  ? { color: ["#fbbf24", "#f87171", "#fbbf24"] }
                  : { color: "#fbbf24" }
              }
              transition={
                isRadioactive ? { duration: 1.2, repeat: Infinity } : {}
              }
            >
              ${stealCrownDollars}
            </motion.span>
          </span>
        </div>

        {/* ── Handle ── */}
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block font-medium tracking-widest">
            YOUR HANDLE
          </label>
          <input
            type="text"
            value={fanHandle}
            onChange={(e) => setFanHandle(e.target.value)}
            placeholder="@yourname"
            maxLength={30}
            className={inputClass}
          />
        </div>

        {/* ── Message ── */}
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block font-medium tracking-widest">
            MESSAGE{" "}
            <span className="text-slate-700 normal-case tracking-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your victory speech..."
            maxLength={100}
            className={inputClass}
          />
        </div>

        {/* ── Amount ── */}
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block font-medium tracking-widest">
            BID AMOUNT (USD)
          </label>
          <div className="relative">
            <motion.span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-extrabold"
              animate={{ color: isRadioactive ? "#f97316" : "#64748b" }}
              transition={{ duration: 0.3 }}
            >
              $
            </motion.span>
            <input
              type="number"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              placeholder={String(minimumDollars)}
              min={minimumDollars}
              max={MAXIMUM_BID_DOLLARS}
              step="1"
              className={
                "w-full bg-slate-950 border rounded-xl pl-10 pr-4 py-4 text-slate-100 " +
                "text-2xl font-extrabold focus:outline-none transition-all " +
                "focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] " +
                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none " +
                "[&::-webkit-inner-spin-button]:appearance-none " +
                (isRadioactive
                  ? "border-orange-500/60 focus:border-orange-400"
                  : "border-slate-700 focus:border-indigo-500/70")
              }
            />
          </div>
        </div>

        {/* ── Error message ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.97 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="text-red-400 text-sm text-center bg-red-950/60 border border-red-800/50
                         rounded-xl px-4 py-3 font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── The Radioactive Submit Button ── */}
        <motion.button
          onClick={handleSubmit}
          disabled={loading || cooldownSeconds > 0}
          className={
            "w-full py-5 rounded-xl font-extrabold text-white text-base relative overflow-hidden " +
            "disabled:opacity-50 disabled:cursor-not-allowed " +
            (isRadioactive
              ? "bg-gradient-to-r from-orange-500 via-red-500 to-orange-600"
              : "bg-gradient-to-r from-indigo-600 to-violet-700")
          }
          // Continuous heartbeat pulse in radioactive mode
          animate={
            isRadioactive && !loading
              ? { scale: [1, 1.035, 1, 1.035, 1] }
              : { scale: 1 }
          }
          transition={
            isRadioactive && !loading
              ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
          whileTap={{ scale: 0.96 }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <motion.span
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              />
              Processing...
            </span>
          ) : cooldownSeconds > 0 ? (
            <span className="relative z-10 tabular-nums">
              Try again in {cooldownSeconds}s...
            </span>
          ) : (
            <span className="relative z-10">
              {isRadioactive ? "👑 STEAL THE CROWN" : "Claim Your Spot"}
            </span>
          )}

          {/* Shimmer sweep — always present, faster in radioactive mode */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{
              duration: isRadioactive ? 1.2 : 2.5,
              repeat: Infinity,
              repeatDelay: isRadioactive ? 0.3 : 0.8,
            }}
          />
        </motion.button>
      </motion.div>
    </div>
  );
}
