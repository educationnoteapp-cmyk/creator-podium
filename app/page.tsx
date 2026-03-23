'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useSpring,
  animate as fmAnimate,
  useInView,
  AnimatePresence,
} from 'framer-motion';

const BackgroundArena = dynamic(() => import('@/components/BackgroundArena'), { ssr: false });

// ─── Revenue formula ────────────────────────────────────────────────────────
// Under 1M  : followers × 0.005
// Over  1M  : (followers × 0.005) + (followers × 0.01)
function calcRevenue(followers: number): number {
  if (followers <= 1_000_000) return followers * 0.005;
  return followers * 0.005 + followers * 0.01;
}

// ─── Log-scale slider: 0–100 → 10 K – 10 M followers ───────────────────────
function sliderToFollowers(v: number): number {
  const min = Math.log10(10_000);
  const max = Math.log10(10_000_000);
  return Math.round(Math.pow(10, min + (v / 100) * (max - min)));
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

// ─── Spring-animated dollar display ────────────────────────────────────────
function SpringDollar({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 80, damping: 14, mass: 0.7 });
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; mv.set(value); return; }
    fmAnimate(mv, value, { duration: 1.2, ease: [0.12, 1, 0.28, 1] });
  }, [value, mv]);

  useEffect(() =>
    spring.on('change', (v) => {
      if (ref.current)
        ref.current.textContent = `$${Math.round(Math.max(0, v)).toLocaleString('en-US')}`;
    }), [spring]);

  return (
    <span ref={ref} className={className}>
      ${Math.round(value).toLocaleString('en-US')}
    </span>
  );
}

// ─── Moving-border CTA button ───────────────────────────────────────────────
function MovingBorderButton({
  children,
  href,
  large,
}: {
  children: React.ReactNode;
  href: string;
  large?: boolean;
}) {
  return (
    <Link href={href} className="relative inline-flex group">
      {/* Rotating gradient ring */}
      <motion.span
        aria-hidden
        className="absolute -inset-[2px] rounded-2xl"
        style={{
          background:
            'conic-gradient(from 0deg, #FFD700, #00FFFF, #FFD700, #00FFFF, #FFD700)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      {/* Outer glow */}
      <motion.span
        aria-hidden
        className="absolute -inset-[6px] rounded-3xl opacity-40 blur-lg"
        style={{ background: 'conic-gradient(from 0deg, #FFD700, #00FFFF, #FFD700)' }}
        animate={{ rotate: -360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />
      {/* Button face */}
      <span
        className={`relative z-10 bg-slate-950 text-white font-extrabold rounded-2xl flex items-center justify-center
          ${large
            ? 'px-8 py-5 text-lg sm:text-xl min-h-[60px] sm:min-h-[64px]'
            : 'px-6 py-4 text-base sm:text-lg min-h-[56px]'
          }
          group-hover:bg-slate-900 transition-colors`}
      >
        {children}
      </span>
    </Link>
  );
}

// ─── Floating phone mockup ──────────────────────────────────────────────────
function PhoneMockup() {
  const bids = [
    { handle: '@CryptoChad',      amount: '$1,200', color: 'text-yellow-400' },
    { handle: '@BigSpenderSteve', amount: '$1,100', color: 'text-cyan-400'   },
    { handle: '@DadJokeDave',     amount: '$1,000', color: 'text-slate-300'  },
  ];

  return (
    <motion.div
      animate={{ y: [0, -12, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="relative mx-auto"
      style={{ width: 200, height: 400 }}
    >
      {/* Gold glow behind phone */}
      <div
        className="absolute inset-0 rounded-[2.5rem] blur-2xl opacity-40"
        style={{ background: 'radial-gradient(ellipse, #FFD700 0%, transparent 70%)' }}
      />
      {/* Phone shell */}
      <div
        className="relative w-full h-full rounded-[2.5rem] border-2 overflow-hidden flex flex-col"
        style={{
          background: '#0a0a14',
          borderColor: '#FFD700',
          boxShadow: '0 0 40px rgba(255,215,0,0.35), inset 0 0 20px rgba(255,215,0,0.04)',
        }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <span className="text-[9px] text-slate-500 font-mono">9:41</span>
          <div className="w-12 h-3 rounded-full bg-slate-800" />
          <span className="text-[9px] text-slate-500">●●●</span>
        </div>

        {/* App header */}
        <div className="px-4 pt-1 pb-2 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 text-center">podium.vip/mrbeast</p>
        </div>

        {/* Crown */}
        <div className="flex flex-col items-center pt-4 pb-2">
          <motion.div
            animate={{ scale: [1, 1.25, 1], rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-3xl leading-none"
          >
            👑
          </motion.div>
          <p className="text-[10px] text-yellow-400 font-bold mt-1">@CryptoChad</p>
          <p className="text-[11px] text-white font-black">$1,200</p>
          <p className="text-[8px] text-slate-600 mt-0.5 italic">"TO THE MOON 🚀"</p>
        </div>

        {/* Leaderboard rows */}
        <div className="flex-1 px-3 space-y-1.5 pt-2">
          {bids.map((b, i) => (
            <motion.div
              key={b.handle}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              className="flex items-center justify-between bg-slate-800/60 rounded-xl px-2.5 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-600 font-mono w-3">
                  {i + 1}
                </span>
                <span className="text-[9px] text-slate-300 font-semibold truncate max-w-[80px]">
                  {b.handle}
                </span>
              </div>
              <span className={`text-[10px] font-black ${b.color}`}>{b.amount}</span>
            </motion.div>
          ))}
        </div>

        {/* Bid CTA inside phone */}
        <div className="px-3 pb-4 pt-2">
          <div
            className="w-full py-2 rounded-xl text-center text-[10px] font-black text-slate-950"
            style={{ background: 'linear-gradient(90deg, #FFD700, #00FFFF)' }}
          >
            BID TO TOP 🔥
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Manifesto highlight word ───────────────────────────────────────────────
function Highlight({
  children,
  color = 'gold',
}: {
  children: React.ReactNode;
  color?: 'gold' | 'cyan';
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.span
      ref={ref}
      className={`font-black ${color === 'gold' ? 'text-yellow-400' : 'text-cyan-400'}`}
      initial={{ opacity: 0.3 }}
      animate={inView ? { opacity: 1 } : { opacity: 0.3 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.span>
  );
}

// ─── Step card ──────────────────────────────────────────────────────────────
function StepCard({
  step,
  icon,
  title,
  body,
  delay,
}: {
  step: string;
  icon: string;
  title: string;
  body: string;
  delay: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6
                 hover:border-yellow-400/30 transition-colors group overflow-hidden"
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,215,0,0.06), transparent 60%)' }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{icon}</span>
          <span
            className="text-xs font-black tracking-widest uppercase px-2 py-1 rounded-lg"
            style={{ color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}
          >
            {step}
          </span>
        </div>
        <h3 className="text-white font-black text-xl mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
      </div>
    </motion.div>
  );
}

// ─── Section fade-in wrapper ────────────────────────────────────────────────
function FadeSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PAGE
// ────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [sliderVal, setSliderVal] = useState(50);
  const followers = sliderToFollowers(sliderVal);
  const revenue = calcRevenue(followers);

  return (
    <div className="bg-slate-950 text-white overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 pt-12 pb-20">

        {/* Particle canvas */}
        <div className="absolute inset-0 z-0">
          <BackgroundArena />
        </div>

        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950" />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto w-full">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <span
              className="text-xs font-black tracking-widest uppercase px-4 py-2 rounded-full border"
              style={{
                color: '#FFD700',
                borderColor: 'rgba(255,215,0,0.35)',
                background: 'rgba(255,215,0,0.07)',
              }}
            >
              👑 0% fee for launch cohort · First 10 creators only
            </span>
          </motion.div>

          {/* Layout: text left, phone right on desktop; stacked on mobile */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Text side */}
            <div className="flex-1 text-center lg:text-left order-2 lg:order-1">
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight"
              >
                Stop leaving{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #FFD700, #00FFFF)' }}
                >
                  millions
                </span>{' '}
                on the table.
                <br className="hidden sm:block" />
                {' '}Turn your comments into an{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #00FFFF, #FFD700)' }}
                >
                  ego auction.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                The system is broken. Platforms are making a fortune off you.
                It's time you get paid{' '}
                <span className="text-white font-semibold">directly by your audience</span>,
                straight to your Stripe.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <MovingBorderButton href="/login" large>
                  Claim Your Podium — 0% Fee for Launch Cohort 🔥
                </MovingBorderButton>
              </motion.div>

              {/* Social proof row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 flex items-center gap-3 justify-center lg:justify-start"
              >
                <div className="flex -space-x-2">
                  {['C', 'M', 'K', 'J', 'A'].map((l, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold"
                      style={{ background: `hsl(${i * 47 + 200}, 70%, 45%)` }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  <span className="text-white font-semibold">9/10 spots</span> already claimed
                </p>
              </motion.div>
            </div>

            {/* Phone side */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex-shrink-0 order-1 lg:order-2"
            >
              <PhoneMockup />
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — MANIFESTO
      ══════════════════════════════════════════════════════════════════ */}
      <FadeSection className="relative py-24 px-4 bg-black">
        {/* Subtle cyan glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] blur-3xl opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #00FFFF, transparent 70%)' }}
        />

        <div className="relative max-w-3xl mx-auto text-center space-y-8">
          <p className="text-xs font-black tracking-widest uppercase text-slate-600">The Movement</p>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
            <Highlight color="gold">Traditional social media</Highlight>{' '}
            rewards performance over profit.
          </h2>

          <p className="text-xl sm:text-2xl font-bold text-slate-200 leading-relaxed">
            The Podium is{' '}
            <Highlight color="cyan">direct-to-creator monetization.</Highlight>
          </p>

          <div className="grid sm:grid-cols-3 gap-6 text-left pt-4">
            {[
              {
                icon: '🚫',
                title: 'No brand deals.',
                body: 'Stop begging for sponsorships that pay peanuts and make you look like a walking billboard.',
              },
              {
                icon: '🚫',
                title: 'No ads.',
                body: 'Stop sharing revenue with algorithms that decide who sees your content — and who doesn\'t.',
              },
              {
                icon: '💰',
                title: 'Pure attention-to-cash.',
                body: 'Your audience bids for the top spot on your Podium. You collect 100% of every dollar.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5"
              >
                <span className="text-2xl">{item.icon}</span>
                <p className="text-white font-black mt-2 text-sm">{item.title}</p>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <p className="text-lg sm:text-xl text-slate-400 italic leading-relaxed pt-2">
            For creators who are{' '}
            <span className="text-white font-black not-italic">tired of feeding the platforms.</span>
          </p>
        </div>
      </FadeSection>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — GREED CALCULATOR
      ══════════════════════════════════════════════════════════════════ */}
      <FadeSection className="py-24 px-4 bg-slate-950">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-xs font-black tracking-widest uppercase text-slate-600 mb-3">
              The Greed Calculator
            </p>
            <h2 className="text-3xl sm:text-4xl font-black leading-tight">
              How much are you{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg, #FFD700, #00FFFF)' }}
              >
                leaving on the table?
              </span>
            </h2>
            <p className="text-slate-400 mt-3 text-sm">
              Move the slider. Watch your money.
            </p>
          </div>

          {/* Calculator card */}
          <div
            className="rounded-3xl border p-8 space-y-8"
            style={{
              background: 'linear-gradient(135deg, #0d0d1a, #0a0a14)',
              borderColor: 'rgba(255,215,0,0.25)',
              boxShadow: '0 0 60px rgba(255,215,0,0.06)',
            }}
          >
            {/* Follower label */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium">How many followers?</span>
              <span
                className="text-lg font-black"
                style={{ color: '#FFD700' }}
              >
                {formatFollowers(followers)} followers
              </span>
            </div>

            {/* Slider */}
            <div className="relative">
              <input
                type="range"
                min={0}
                max={100}
                value={sliderVal}
                onChange={(e) => setSliderVal(Number(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(
                    to right,
                    #FFD700 0%,
                    #00FFFF ${sliderVal}%,
                    #1e2030 ${sliderVal}%,
                    #1e2030 100%
                  )`,
                  // Large touch target via padding
                  padding: '12px 0',
                  WebkitAppearance: 'none',
                }}
              />
            </div>

            {/* Scale labels */}
            <div className="flex justify-between text-xs text-slate-600 -mt-4">
              <span>10K</span>
              <span>100K</span>
              <span>1M</span>
              <span>10M</span>
            </div>

            {/* Revenue output */}
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-widest font-semibold">
                Estimated Monthly Revenue
              </p>
              <SpringDollar
                value={revenue}
                className="text-6xl sm:text-7xl font-black text-yellow-400"
              />
              <p className="text-slate-600 text-sm mt-3">per month · paid directly to your Stripe</p>
            </div>

            {/* CTA */}
            <div className="flex justify-center pt-2">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 min-h-[56px] px-8 py-4 rounded-2xl
                           font-black text-slate-950 text-base sm:text-lg transition-all
                           hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(90deg, #FFD700, #00FFFF)',
                  boxShadow: '0 0 30px rgba(255,215,0,0.3)',
                }}
              >
                Unleash this revenue →
              </Link>
            </div>
          </div>
        </div>
      </FadeSection>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — NO FRICTION / 3 STEPS
      ══════════════════════════════════════════════════════════════════ */}
      <FadeSection className="py-24 px-4 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-black tracking-widest uppercase text-slate-600 mb-3">
              Zero Friction
            </p>
            <h2 className="text-3xl sm:text-4xl font-black">
              Up and running in{' '}
              <span style={{ color: '#00FFFF' }}>3 steps.</span>
            </h2>
            <p className="text-slate-400 mt-3 text-sm">No integrations. No sales team. No waiting.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StepCard
              step="Step 1"
              icon="⚡"
              title="CONNECT"
              body="Connect your Stripe in 2 clicks. Every dollar your fans pay goes 100% directly to you — we never touch it."
              delay={0}
            />
            <StepCard
              step="Step 2"
              icon="🔗"
              title="COPY"
              body="Get your personal link: podium.vip/yourname — your own branded auction page, live instantly."
              delay={0.1}
            />
            <StepCard
              step="Step 3"
              icon="💸"
              title="CASH"
              body="Drop it in your bio, post a story, mention it live. Watch your podium explode in real-time."
              delay={0.2}
            />
          </div>
        </div>
      </FadeSection>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — FINAL CTA / FOMO
      ══════════════════════════════════════════════════════════════════ */}
      <FadeSection className="relative py-28 px-4 overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,215,0,0.08), transparent)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,255,255,0.05), transparent)',
          }}
        />

        <div className="relative max-w-2xl mx-auto text-center space-y-6">
          {/* Live spots indicator */}
          <div className="flex items-center justify-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-xs text-red-400 font-bold tracking-widest uppercase">
              Live — spots filling now
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            Spots in our{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #FFD700, #00FFFF)' }}
            >
              Launch Cohort
            </span>{' '}
            are limited.
          </h2>

          {/* Subtext */}
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
            The first{' '}
            <span className="text-white font-black">10 creators</span>{' '}
            get{' '}
            <span style={{ color: '#FFD700' }} className="font-black">
              0% platform fee. Forever.
            </span>
            <br />
            <span className="text-slate-400 text-base">
              No tricks. No expiry. Locked in for life.
            </span>
          </p>

          {/* Spots remaining bar */}
          <div className="max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Spots claimed</span>
              <span className="text-yellow-400 font-bold">9 / 10</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #FFD700, #00FFFF)' }}
                initial={{ width: '0%' }}
                whileInView={{ width: '90%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              />
            </div>
          </div>

          {/* Final CTA button */}
          <div className="pt-4">
            <MovingBorderButton href="/login" large>
              Claim Your Podium VIP Access 👑
            </MovingBorderButton>
          </div>

          <p className="text-xs text-slate-600 pt-2">
            Free to start · Your own Stripe · Cancel any time
          </p>
        </div>
      </FadeSection>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-slate-900 text-center">
        <p className="text-xs text-slate-700">
          Creator Podium · Direct fan monetization for the creators who refuse to be exploited
        </p>
      </footer>

      {/* Global slider thumb styles */}
      <style jsx global>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #FFD700;
          border: 3px solid #0a0a14;
          box-shadow: 0 0 12px rgba(255,215,0,0.6);
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #FFD700;
          border: 3px solid #0a0a14;
          box-shadow: 0 0 12px rgba(255,215,0,0.6);
          cursor: pointer;
        }
        input[type='range']:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
