'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlanActionsProps {
  creatorId: string;
  currentPlan: string;
  foundingCount: number;
  onPlanChange: (creatorId: string, newPlan: string) => void;
}

const PLANS = [
  { key: 'founding', label: '👑 Founding', activeClass: 'border-yellow-400/60 text-yellow-400 bg-yellow-400/10' },
  { key: 'pro',      label: '⚡ Pro',      activeClass: 'border-purple-400/60 text-purple-400 bg-purple-400/10' },
  { key: 'starter',  label: 'Starter',     activeClass: 'border-slate-500/60 text-slate-300 bg-slate-800/60'   },
] as const;

export default function PlanActions({
  creatorId,
  currentPlan,
  foundingCount,
  onPlanChange,
}: PlanActionsProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSet = async (planKey: string) => {
    if (planKey === currentPlan) return;
    if (planKey === 'founding' && foundingCount >= 10) {
      setFlash({ type: 'err', text: '⚠ Founding limit reached (10/10)' });
      setTimeout(() => setFlash(null), 3000);
      return;
    }
    setSaving(planKey);

    const res = await fetch('/api/admin/set-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId, planType: planKey }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }));
      setFlash({ type: 'err', text: body.error ?? 'Failed to update plan' });
    } else {
      onPlanChange(creatorId, planKey);
      setFlash({ type: 'ok', text: `Set to ${planKey}` });
    }
    setSaving(null);
    setTimeout(() => setFlash(null), 2500);
  };

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex gap-1.5 flex-wrap justify-end">
        {PLANS.map(({ key, label, activeClass }) => {
          const isActive = currentPlan === key;
          const isLoading = saving === key;
          return (
            <motion.button
              key={key}
              disabled={isActive || !!saving}
              onClick={() => handleSet(key)}
              whileTap={{ scale: 0.94 }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                ${isActive
                  ? activeClass
                  : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                }
                disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                </span>
              ) : label}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {flash && (
          <motion.span
            key="flash"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-[10px] font-medium ${flash.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}
          >
            {flash.text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
