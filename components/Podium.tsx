'use client';

// Podium.tsx — The top 3 spots: King (#1), Runner-up (#2), Jester (#3).
//
// BIDDING WAR: Position is determined by amount_paid rank.
// Highest bid = King (#1). The crown pulses gold with a particle explosion
// when a new King is crowned. Outbid animations include dramatic shake +
// slide displacement. Screen flash on every new bid event.

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { Bid } from '@/types';

// ---- Animated count-up for dollar amounts ----
function AnimatedAmount({ cents, className }: { cents: number; className?: string }) {
  const [display, setDisplay] = useState(cents);
  const prevRef = useRef(cents);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = cents;
    if (prev === cents) return;

    const diff = cents - prev;
    const steps = 20;
    const stepSize = diff / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setDisplay(Math.round(prev + stepSize * step));
      if (step >= steps) {
        setDisplay(cents);
        clearInterval(interval);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [cents]);

  return (
    <span className={className}>
      ${(display / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
    </span>
  );
}

// ---- Confetti + Particle Explosion System ----
interface ParticleCanvasProps {
  fire: boolean;
  onDone: () => void;
}

function ParticleCanvas({ fire, onDone }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const colors = ['#FFD700', '#FF6B6B', '#4F46E5', '#7C3AED', '#059669', '#F59E0B', '#EC4899', '#FFFFFF'];

    type Particle = {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; rotation: number; spin: number;
      life: number; type: 'confetti' | 'spark' | 'ring';
    };

    const particles: Particle[] = [];

    // Confetti burst from center
    for (let i = 0; i < 120; i++) {
      const angle = (Math.PI * 2 * i) / 120 + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 14 + 4;
      particles.push({
        x: w / 2, y: h * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: Math.random() * 7 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 15,
        life: 1,
        type: 'confetti',
      });
    }

    // Gold sparks radiating out
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 6;
      particles.push({
        x: w / 2, y: h * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: Math.random() * 3 + 1,
        color: '#FFD700',
        rotation: 0, spin: 0,
        life: 1,
        type: 'spark',
      });
    }

    // Expanding rings
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: w / 2, y: h * 0.35,
        vx: 0, vy: 0,
        size: 10 + i * 30,
        color: '#FFD700',
        rotation: 0, spin: 0,
        life: 1,
        type: 'ring',
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;

      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;

        if (p.type === 'confetti') {
          p.x += p.vx;
          p.vy += 0.3;
          p.y += p.vy;
          p.vx *= 0.98;
          p.rotation += p.spin;
          p.life -= 0.015;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
          ctx.restore();
        } else if (p.type === 'spark') {
          p.x += p.vx;
          p.vy += 0.15;
          p.y += p.vy;
          p.life -= 0.025;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'ring') {
          p.size += 3;
          p.life -= 0.02;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life * 0.4);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (alive) {
        animId = requestAnimationFrame(animate);
      } else {
        onDone();
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [fire, onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
    />
  );
}

// ---- Screen Flash overlay ----
function ScreenFlash({ fire }: { fire: boolean }) {
  return (
    <AnimatePresence>
      {fire && (
        <motion.div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, times: [0, 0.15, 1] }}
        />
      )}
    </AnimatePresence>
  );
}

// ---- Crown SVG with pulsing glow ----
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.97 10l-2.2-6.6a1.5 1.5 0 0 0-2.84.08L7.8 10.02l-5.13-1.38c-.8-.22-1.64.26-1.85 1.06-.1.4-.02.82.23 1.14l5.4 6.9h11.28l5.12-6.86c.26-.33.35-.76.22-1.14z" />
    </svg>
  );
}

const SPOT_LABELS: Record<number, string> = { 1: 'KING', 2: 'RUNNER-UP', 3: 'JESTER' };

// ---- Spot Card with outbid shake animation ----
function SpotCard({ bid, rank, prevBidId }: { bid: Bid | null; rank: 1 | 2 | 3; prevBidId: string | null }) {
  const controls = useAnimation();
  const isKing = rank === 1;

  // Detect outbid: bid holder changed → shake the column
  useEffect(() => {
    if (prevBidId && bid && bid.id !== prevBidId) {
      controls.start({
        x: [0, -8, 8, -6, 6, -3, 3, 0],
        transition: { duration: 0.5 },
      });
    }
  }, [bid?.id, prevBidId, controls]);

  const heightClass = isKing ? 'h-72' : rank === 2 ? 'h-56' : 'h-48';
  const orderClass = rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3';

  return (
    <motion.div
      layout
      animate={controls}
      className={`flex flex-col items-center ${orderClass} flex-1 max-w-[200px]`}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18, delay: rank * 0.12 }}
      viewport={{ once: true }}
    >
      {/* Avatar + Crown */}
      <div className="relative mb-3">
        {isKing && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-10"
            animate={{
              y: [0, -3, 0],
              filter: [
                'drop-shadow(0 0 4px #FFD700) drop-shadow(0 0 8px rgba(255,215,0,0.5))',
                'drop-shadow(0 0 12px #FFD700) drop-shadow(0 0 24px rgba(255,215,0,0.6))',
                'drop-shadow(0 0 4px #FFD700) drop-shadow(0 0 8px rgba(255,215,0,0.5))',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CrownIcon className="w-11 h-11 text-yellow-400" />
          </motion.div>
        )}

        {/* Avatar glow ring for King */}
        {isKing && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ margin: '-4px' }}
            animate={{
              boxShadow: [
                '0 0 10px rgba(255,215,0,0.3), 0 0 30px rgba(255,215,0,0.15)',
                '0 0 20px rgba(255,215,0,0.5), 0 0 50px rgba(255,215,0,0.25)',
                '0 0 10px rgba(255,215,0,0.3), 0 0 30px rgba(255,215,0,0.15)',
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        )}

        <motion.div
          className={`rounded-full overflow-hidden border-2 ${
            isKing
              ? 'w-20 h-20 border-yellow-400'
              : rank === 2
              ? 'w-16 h-16 border-slate-400'
              : 'w-14 h-14 border-amber-700'
          } bg-surface relative`}
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {bid?.fan_avatar_url ? (
            <Image
              src={bid.fan_avatar_url}
              alt={bid.fan_handle}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-muted ${isKing ? 'text-2xl' : 'text-lg'} font-bold`}>
              {bid ? bid.fan_handle.charAt(0).toUpperCase() : '?'}
            </div>
          )}
        </motion.div>
      </div>

      {/* Podium Column */}
      <motion.div
        className={`${heightClass} w-full rounded-t-2xl flex flex-col items-center justify-start pt-5 px-3 relative overflow-hidden ${
          isKing
            ? 'bg-gradient-to-b from-yellow-500/20 via-yellow-500/5 to-surface border border-yellow-500/30'
            : rank === 2
            ? 'bg-gradient-to-b from-slate-400/15 to-surface border border-slate-400/20'
            : 'bg-gradient-to-b from-amber-700/15 to-surface border border-amber-700/20'
        }`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.3 + rank * 0.15 }}
        style={{ transformOrigin: 'bottom' }}
      >
        {/* Ambient glow for King */}
        {isKing && (
          <>
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at top, rgba(255,215,0,0.08) 0%, transparent 60%)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            {/* Floating particles inside King column */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-yellow-400/60"
                style={{ left: `${20 + i * 15}%` }}
                animate={{
                  y: ['100%', '-20%'],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 3 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}

        <span className={`text-xs font-extrabold tracking-[0.2em] mb-2 ${
          isKing ? 'text-yellow-400' : rank === 2 ? 'text-slate-400' : 'text-amber-600'
        }`}>
          #{rank} {SPOT_LABELS[rank]}
        </span>

        {bid ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={bid.id}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -20 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
            >
              <span className="text-sm font-bold text-text-main truncate max-w-full">
                {bid.fan_handle}
              </span>
              <AnimatedAmount
                cents={bid.amount_paid}
                className={`text-xl font-extrabold mt-1 ${isKing ? 'text-yellow-400' : 'text-primary'}`}
              />
              {bid.message && (
                <motion.p
                  className="text-xs text-muted mt-2 line-clamp-2 italic max-w-[160px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  &ldquo;{bid.message}&rdquo;
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            className="flex flex-col items-center gap-1 mt-3"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <span className="text-muted text-sm font-medium">Empty</span>
            <span className="text-xs text-muted">Be the first!</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---- Main Podium Component ----
interface PodiumProps {
  spots: (Bid | null)[];
  onBid: (currentAmount: number) => void;
}

export default function Podium({ spots, onBid }: PodiumProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const prevKingRef = useRef<string | null>(null);
  const prevBidIdsRef = useRef<(string | null)[]>([null, null, null]);

  const currentKingId = spots[0]?.id ?? null;

  // Previous spot IDs passed to children so SpotCard can detect outbid & shake.
  // Must be state (not just a ref) so children re-render with the old values.
  const [prevSpotIds, setPrevSpotIds] = useState<(string | null)[]>([null, null, null]);

  useEffect(() => {
    const prevRefIds = prevBidIdsRef.current;
    // Any change in the top 3 triggers a screen flash
    const changed = spots.slice(0, 3).some((s, i) => (s?.id ?? null) !== prevRefIds[i]);

    if (changed && prevRefIds.some(id => id !== null)) {
      // Snapshot OLD ids for children BEFORE updating the ref — enables shake animation
      setPrevSpotIds([...prevRefIds]);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 700);
    }

    // New King → confetti explosion
    if (prevKingRef.current !== null && currentKingId !== prevKingRef.current && currentKingId !== null) {
      setShowConfetti(true);
    }

    prevKingRef.current = currentKingId;
    prevBidIdsRef.current = spots.slice(0, 3).map(s => s?.id ?? null);
  }, [spots, currentKingId]);

  const handleConfettiDone = useCallback(() => setShowConfetti(false), []);

  return (
    <div className="relative w-full max-w-lg mx-auto px-4 pt-14 pb-4">
      {/* Screen flash */}
      <ScreenFlash fire={showFlash} />

      {/* Particle explosion */}
      <ParticleCanvas fire={showConfetti} onDone={handleConfettiDone} />

      {/* Title */}
      <motion.h2
        className="text-center text-xl font-extrabold text-text-main mb-10 tracking-[0.15em]"
        initial={{ opacity: 0, y: -14, letterSpacing: '0.3em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.15em' }}
        transition={{ duration: 0.6 }}
      >
        THE PODIUM
      </motion.h2>

      {/* 3-column podium: Runner-up | King | Jester */}
      <div className="flex items-end justify-center gap-3">
        <SpotCard bid={spots[1] ?? null} rank={2} prevBidId={prevSpotIds[1]} />
        <SpotCard bid={spots[0] ?? null} rank={1} prevBidId={prevSpotIds[0]} />
        <SpotCard bid={spots[2] ?? null} rank={3} prevBidId={prevSpotIds[2]} />
      </div>
    </div>
  );
}
