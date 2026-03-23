'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useSpring, animate as fmAnimate } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { getSession, signOut } from '@/lib/auth';
import RollingNumber from '@/components/RollingNumber';
import type { User } from '@supabase/supabase-js';
import type { Bid } from '@/types';

// ── Rolling count (integers, no $ prefix) ──────────────────────────────────
function RollingCount({ value, className }: { value: number; className?: string }) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { stiffness: 90, damping: 14, mass: 0.6 });
  const displayRef = useRef<HTMLSpanElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      motionValue.set(value);
      return;
    }
    fmAnimate(motionValue, value, { duration: 1.4, ease: [0.12, 1, 0.28, 1] });
  }, [value, motionValue]);

  useEffect(() => {
    return springValue.on('change', (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = Math.round(Math.max(0, v)).toLocaleString('en-US');
      }
    });
  }, [springValue]);

  return (
    <span ref={displayRef} className={className}>
      {Math.round(value).toLocaleString('en-US')}
    </span>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────
interface Analytics {
  totalRevenueCents: number;
  totalBids: number;
  currentKing: Bid | null;
  avgBidCents: number;
}

interface CreatorRow {
  id: string;
  slug: string;
  stripe_account_id: string | null;
  plan_type: string;
  auth_user_id: string;
}

// ── Slug validation ─────────────────────────────────────────────────────────
function validateSlug(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (s.length < 3) return 'Slug must be at least 3 characters';
  return null;
}

function cleanSlug(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

// ── Plan badge config ────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, {
  badge: string;
  badgeClass: string;
  dotClass: string;
  headline: string;
  body: string;
  showUpgrade: boolean;
}> = {
  founding: {
    badge: '👑 Founding Creator',
    badgeClass: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    dotClass: 'bg-yellow-400',
    headline: '0% Platform Fee — Forever',
    body: 'You are one of our 10 founding creators. 100% of every payment goes directly to you.',
    showUpgrade: false,
  },
  pro: {
    badge: '⚡ Pro',
    badgeClass: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    dotClass: 'bg-purple-400',
    headline: '0% Platform Fee',
    body: 'You are on the Pro plan. Every dollar fans pay goes straight to you.',
    showUpgrade: false,
  },
  starter: {
    badge: 'Starter',
    badgeClass: 'text-slate-400 bg-slate-700/40 border-slate-600/40',
    dotClass: 'bg-slate-400',
    headline: '15% Platform Fee',
    body: 'Upgrade to Pro to keep 100% of every payment.',
    showUpgrade: true,
  },
};

// ── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createClient();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Creator row
  const [creator, setCreator] = useState<CreatorRow | null>(null);

  // Slug section
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Stripe Connect section
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeConnectMsg, setStripeConnectMsg] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<Analytics>({
    totalRevenueCents: 0,
    totalBids: 0,
    currentKing: null,
    avgBidCents: 0,
  });

  // Seeding
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then((session) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);
      setAuthLoading(false);
    });
  }, []);

  // ── Handle Stripe Connect callback query params ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('stripe_connect');
    if (!result) return;
    if (result === 'success') {
      setStripeConnectMsg({ type: 'ok', text: '✓ Stripe connected successfully!' });
    } else if (result === 'cancelled') {
      setStripeConnectMsg({ type: 'warn', text: 'Stripe connection cancelled.' });
    } else if (result === 'error') {
      const reason = params.get('reason') ?? 'unknown';
      setStripeConnectMsg({ type: 'err', text: `Connection failed: ${reason}` });
    }
    // Clean up URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('stripe_connect');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
    setTimeout(() => setStripeConnectMsg(null), 6000);
  }, []);

  // ── Load / create creator row ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function loadOrCreate() {
      const { data: existing } = await supabase
        .from('creators')
        .select('*')
        .eq('auth_user_id', user!.id)
        .maybeSingle();

      if (existing) {
        hydrate(existing);
        return;
      }

      // First login — create creator row via API (uses supabaseAdmin to bypass RLS)
      const emailUser = (user!.email ?? '').split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '') || 'creator';
      const tempSlug = `${emailUser}-${user!.id.slice(0, 6)}`;

      const res = await fetch('/api/dashboard/creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: tempSlug }),
      });

      if (res.ok) {
        const body = await res.json() as { creator: CreatorRow };
        if (body.creator) hydrate(body.creator);
      }
    }

    loadOrCreate();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  function hydrate(row: CreatorRow) {
    setCreator(row);
    setSlug(row.slug ?? '');
    setStripeConnected(!!row.stripe_account_id);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async (cid: string) => {
    const { data: bids } = await supabase
      .from('bids')
      .select('*')
      .eq('creator_id', cid);

    const totalRevenueCents = bids?.reduce((s, b) => s + b.amount_paid, 0) ?? 0;
    const totalBids = bids?.length ?? 0;
    const avgBidCents = totalBids > 0 ? Math.round(totalRevenueCents / totalBids) : 0;

    const king = bids?.length
      ? bids.reduce((best, b) => (b.amount_paid > best.amount_paid ? b : best), bids[0])
      : null;

    setAnalytics({ totalRevenueCents, totalBids, currentKing: king ?? null, avgBidCents });
  }, [supabase]);

  useEffect(() => {
    if (creator?.id) fetchAnalytics(creator.id);
  }, [creator?.id, fetchAnalytics]);

  // ── Save slug ──────────────────────────────────────────────────────────────
  const handleSaveSlug = async () => {
    const err = validateSlug(slug);
    if (err) { setSlugError(err); return; }
    setSlugError(null);
    setSavingSlug(true);
    setSlugMsg(null);

    const clean = cleanSlug(slug);
    const res = await fetch('/api/dashboard/creator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: clean }),
    });

    const body = await res.json() as { creator?: CreatorRow; error?: { code?: string; message?: string } | string };
    if (!res.ok) {
      const errObj = body.error;
      const errMsg = typeof errObj === 'object' && errObj !== null
        ? (errObj.code === '23505' ? 'That slug is already taken — try another' : (errObj.message ?? 'Failed to save'))
        : (typeof errObj === 'string' ? errObj : 'Failed to save');
      setSlugMsg({ type: 'err', text: errMsg });
    } else if (body.creator) {
      setCreator((c) => c ? { ...c, slug: body.creator!.slug } : c);
      setSlug(body.creator.slug);
      setSlugMsg({ type: 'ok', text: '✓ Saved' });
      setTimeout(() => setSlugMsg(null), 3000);
    }
    setSavingSlug(false);
  };

  // ── Stripe Connect — redirect to OAuth flow ───────────────────────────────
  const handleStripeConnect = () => {
    window.location.href = '/api/stripe/connect';
  };

  // ── Seed fake bids ─────────────────────────────────────────────────────────
  const handleSeed = async () => {
    if (!creator?.id) return;
    if (analytics.totalBids > 0) {
      setSeedMsg('Podium already has bids — seeding disabled');
      return;
    }
    setSeeding(true);
    setSeedMsg(null);

    const res = await fetch('/api/dashboard/seed', { method: 'POST' });
    const body = await res.json() as { ok?: boolean; error?: string };

    if (!res.ok) {
      setSeedMsg(`Error: ${body.error ?? 'Failed to seed'}`);
    } else {
      setSeedMsg('🌱 10 fans seeded! Check your podium.');
      fetchAnalytics(creator.id);
    }
    setSeeding(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          className="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  const planKey = (creator?.plan_type ?? 'starter') as keyof typeof PLAN_CONFIG;
  const plan = PLAN_CONFIG[planKey] ?? PLAN_CONFIG.starter;
  const savedSlug = creator?.slug ?? '';

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── SECTION 1: Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Title */}
          <h1 className="text-sm font-bold text-white tracking-wide">
            Your Podium Dashboard <span className="text-yellow-400">👑</span>
          </h1>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url ? (
                <div className="relative w-8 h-8 flex-shrink-0">
                  <Image
                    src={user.user_metadata.avatar_url}
                    alt={user.email ?? 'avatar'}
                    fill
                    sizes="32px"
                    className="rounded-full object-cover border border-slate-700"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center
                               text-white text-xs font-bold flex-shrink-0">
                  {(user.email ?? 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs text-slate-400 hidden sm:block max-w-[160px] truncate">
                {user.email}
              </span>
              <motion.button
                onClick={() => signOut()}
                className="text-xs text-slate-500 hover:text-red-400 px-3 py-1.5 rounded-lg
                           hover:bg-red-950/30 font-medium transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Log out
              </motion.button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Page heading */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-extrabold text-white">
            Your{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Podium Dashboard
            </span>{' '}
            👑
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configure your podium and track earnings</p>
        </motion.div>

        {/* ── SECTION 3: Analytics ──────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <p className="text-xs font-semibold tracking-widest text-slate-600 uppercase mb-3">Analytics</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Revenue */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4
                           hover:border-green-800/50 transition-colors group">
              <span className="text-[10px] text-slate-500 tracking-widest uppercase block mb-2">Revenue</span>
              <RollingNumber
                value={analytics.totalRevenueCents}
                className="text-2xl font-bold text-green-400"
              />
            </div>

            {/* Total bids */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4
                           hover:border-indigo-800/50 transition-colors">
              <span className="text-[10px] text-slate-500 tracking-widest uppercase block mb-2">Bids</span>
              <RollingCount
                value={analytics.totalBids}
                className="text-2xl font-bold text-indigo-400"
              />
            </div>

            {/* Current King */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4
                           hover:border-yellow-800/50 transition-colors">
              <span className="text-[10px] text-slate-500 tracking-widest uppercase block mb-2">King</span>
              <span className="text-base font-bold text-yellow-400 truncate block">
                {analytics.currentKing?.fan_handle ?? '—'}
              </span>
              {analytics.currentKing && (
                <RollingNumber
                  value={analytics.currentKing.amount_paid}
                  className="text-xs text-slate-500 mt-0.5"
                />
              )}
            </div>

            {/* Avg bid */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4
                           hover:border-violet-800/50 transition-colors">
              <span className="text-[10px] text-slate-500 tracking-widest uppercase block mb-2">Avg Bid</span>
              <RollingNumber
                value={analytics.avgBidCents}
                className="text-2xl font-bold text-violet-400"
              />
            </div>
          </div>
        </motion.section>

        {/* ── SECTION 2a: Slug ──────────────────────────────────────────────── */}
        <motion.section
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <div>
            <h3 className="text-lg font-bold text-white">Setup Your Podium</h3>
            <p className="text-xs text-slate-500 mt-0.5">Choose your public page URL</p>
          </div>

          {/* Slug input */}
          <div>
            <label className="text-[10px] text-slate-500 tracking-widest uppercase block mb-1.5 font-medium">
              Your Page URL
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugError(null);
                setSlugMsg(null);
              }}
              placeholder="mrbeast"
              maxLength={40}
              className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white
                         placeholder:text-slate-600 text-sm
                         focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]
                         transition-all ${slugError
                           ? 'border-red-500/60 focus:border-red-500/80'
                           : 'border-slate-700 focus:border-indigo-500/60'}`}
            />
            {slugError && (
              <p className="text-xs text-red-400 mt-1.5">{slugError}</p>
            )}
          </div>

          {/* Live preview */}
          <div className="bg-slate-950/60 rounded-xl px-4 py-3 border border-slate-800/70">
            <span className="text-xs text-slate-500">Your page: </span>
            <span className="text-sm font-mono">
              <span className="text-slate-600">creatorpodium.com/</span>
              <span className={`font-bold ${cleanSlug(slug).length >= 3 ? 'text-indigo-400' : 'text-slate-600'}`}>
                {slug ? cleanSlug(slug) : '…'}
              </span>
            </span>
          </div>

          {/* Save slug */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleSaveSlug}
              disabled={savingSlug || !creator}
              className="px-5 py-2.5 min-h-[56px] rounded-xl font-semibold text-sm text-white
                         bg-indigo-600 hover:bg-indigo-500
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {savingSlug ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : 'Save URL'}
            </motion.button>

            <AnimatePresence>
              {slugMsg && (
                <motion.span
                  key="slug-msg"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-sm font-medium ${slugMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}
                >
                  {slugMsg.text}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ── SECTION 2b: Stripe Connect ────────────────────────────────────── */}
        <motion.section
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Connect Stripe</h3>
              <p className="text-xs text-slate-500 mt-0.5">Stripe Connect — secure OAuth</p>
            </div>
            <AnimatePresence mode="wait">
              {stripeConnected ? (
                <motion.span
                  key="connected"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-green-400
                             bg-green-500/10 border border-green-500/25 px-3 py-1.5 rounded-full"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  ✓ Connected
                </motion.span>
              ) : (
                <motion.span
                  key="disconnected"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-400
                             bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-full"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Not connected
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Info callout */}
          <div className="bg-indigo-950/40 rounded-xl px-4 py-3 border border-indigo-800/30">
            <p className="text-sm text-white font-semibold">
              💰 Payments land directly in your Stripe account
            </p>
            <p className="text-xs text-slate-400 mt-1">
              We use Stripe Connect OAuth — you never share any secret keys.
              Authorize once and fans can start bidding immediately.
            </p>
          </div>

          {/* Connect / Reconnect button */}
          <motion.button
            onClick={handleStripeConnect}
            disabled={!creator}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 min-h-[56px]
                       rounded-xl font-semibold text-sm
                       bg-[#635BFF] hover:bg-[#4F46E5] text-white
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       shadow-[0_4px_20px_rgba(99,91,255,0.3)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {/* Stripe wordmark */}
            <svg className="w-12 h-5 flex-shrink-0" viewBox="0 0 60 25" fill="white" aria-hidden>
              <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V6.1h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.07-5.65 7.07zM40 9.98c-.97 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.7l4.13-.88V20h-4.13V5.7zm0-4.11 4.13-.88v3.36l-4.13.88V1.59zm-4.32 9.35v9.06H19.8V10.94h-1.96V7.5h1.96V5.99c0-3.45 1.41-5.01 5.15-5.01.93 0 2.08.07 2.8.2v3.4c-.55-.08-1.27-.12-1.74-.12-1.09 0-1.35.54-1.35 1.49V7.5h3.1l-.42 3.44h-2.68zm-9.56 4.72c0 1.37.54 1.87 1.81 1.87.63 0 1.28-.18 1.85-.43v3.24c-.63.29-1.78.56-2.82.56-3.12 0-4.97-1.66-4.97-5.05V9.35H8.07V6.1h2.16V3.41l4.13-.88V6.1h3.1l-.42 3.25h-2.68v5.31zM0 20V0l4.13.88V20H0z" />
            </svg>
            {stripeConnected ? 'Reconnect Stripe Account' : 'Connect with Stripe'}
          </motion.button>

          <AnimatePresence>
            {stripeConnectMsg && (
              <motion.p
                key="connect-msg"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-sm font-medium rounded-xl px-4 py-3 border
                  ${stripeConnectMsg.type === 'ok'
                    ? 'text-green-400 bg-green-950/40 border-green-800/30'
                    : stripeConnectMsg.type === 'warn'
                    ? 'text-amber-400 bg-amber-950/40 border-amber-800/30'
                    : 'text-red-400 bg-red-950/40 border-red-800/30'
                  }`}
              >
                {stripeConnectMsg.text}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── SECTION 4: Podium Controls ───────────────────────────────────── */}
        <motion.section
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <div>
            <h3 className="text-lg font-bold text-white">Podium Controls</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage and preview your live podium</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Seed button */}
            <div className="flex-1">
              <motion.button
                onClick={handleSeed}
                disabled={seeding || !creator || analytics.totalBids > 0}
                className="w-full py-3 min-h-[56px] rounded-xl font-semibold text-sm
                           bg-slate-950 border border-slate-700 text-slate-200
                           hover:border-green-500/40 hover:shadow-[0_0_16px_rgba(34,197,94,0.1)]
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                whileHover={{ scale: analytics.totalBids === 0 ? 1.01 : 1 }}
                whileTap={{ scale: analytics.totalBids === 0 ? 0.97 : 1 }}
              >
                {seeding ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-600 border-t-green-400 rounded-full animate-spin" />
                    Seeding…
                  </span>
                ) : analytics.totalBids > 0 ? (
                  '🌱 Already Seeded'
                ) : (
                  '🌱 Seed My Podium'
                )}
              </motion.button>
              {analytics.totalBids === 0 && (
                <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                  Inserts 10 demo fans — only works on an empty podium
                </p>
              )}
            </div>

            {/* Preview button */}
            <div className="flex-1">
              <motion.a
                href={savedSlug ? `/${savedSlug}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={!savedSlug ? (e) => e.preventDefault() : undefined}
                className={`flex items-center justify-center gap-2 w-full py-3 min-h-[56px] rounded-xl
                           font-semibold text-sm border transition-all
                           ${savedSlug
                             ? 'bg-slate-950 border-indigo-700/50 text-indigo-300 hover:border-indigo-500 hover:shadow-[0_0_16px_rgba(99,102,241,0.15)] cursor-pointer'
                             : 'bg-slate-950/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                           }`}
                whileHover={savedSlug ? { scale: 1.01 } : {}}
                whileTap={savedSlug ? { scale: 0.97 } : {}}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                👁 Preview My Podium
              </motion.a>
              {!savedSlug && (
                <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                  Set and save your slug first
                </p>
              )}
            </div>
          </div>

          <AnimatePresence>
            {seedMsg && (
              <motion.p
                key="seed-msg"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-sm text-center ${seedMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}
              >
                {seedMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── SECTION 5: Plan Badge ─────────────────────────────────────────── */}
        <motion.section
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">Your Plan</h3>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                 border px-3 py-1 rounded-full ${plan.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${plan.dotClass}`} />
                  {plan.badge}
                </span>
              </div>
              <p className={`text-sm font-semibold ${
                planKey === 'founding' ? 'text-yellow-400' :
                planKey === 'pro' ? 'text-purple-400' : 'text-slate-300'
              }`}>
                {plan.headline}
              </p>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                {plan.body}
              </p>
            </div>

            {plan.showUpgrade && (
              <motion.button
                className="px-5 py-2.5 min-h-[56px] rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-purple-600 to-indigo-600
                           hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all flex-shrink-0"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                ⚡ Upgrade to Pro
              </motion.button>
            )}
          </div>

          {planKey === 'founding' && (
            <div className="mt-4 bg-yellow-400/5 border border-yellow-400/15 rounded-xl px-4 py-3">
              <p className="text-xs text-yellow-400/80 leading-relaxed">
                🎖 Founding Creator status is invite-only and permanent.
                Your 0% fee rate will never change — no matter what we charge new creators in the future.
              </p>
            </div>
          )}
        </motion.section>

        <p className="text-xs text-slate-700 text-center pb-8">
          Creator Podium · Your fans compete for the top spot
        </p>
      </div>
    </div>
  );
}
