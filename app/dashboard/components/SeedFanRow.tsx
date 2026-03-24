'use client';

import { useRef, useCallback } from 'react';
import AvatarPicker from '@/components/AvatarPicker';
import type { Bid } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────
export interface SeedEditState {
  handle: string;
  message: string;
  amount: number;
  avatarUrl: string | null;
  isActive: boolean;
  error: string;
}

export interface SeedFanRowProps {
  bid: Bid;
  editState: SeedEditState;
  saveStatus?: 'saving' | 'saved' | 'error';
  onChange: (bidId: string, field: keyof Omit<SeedEditState, 'error' | 'isActive'>, value: string | number | null) => void;
  onBlur: (bidId: string) => void;
  onToggleActive: (bidId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, bidId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, bidId: string) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, bidId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
  minBidDollars: number;
  maxBidDollars: number;
}

// ── Save status indicator ────────────────────────────────────────────────────
function SaveIndicator({ status }: { status?: 'saving' | 'saved' | 'error' }) {
  if (!status) return null;
  if (status === 'saving') {
    return (
      <span className="flex-shrink-0 w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
    );
  }
  if (status === 'saved') {
    return <span className="text-green-400 text-xs font-semibold">✓</span>;
  }
  return <span className="text-red-400 text-xs font-semibold">!</span>;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SeedFanRow({
  bid,
  editState,
  saveStatus,
  onChange,
  onBlur,
  onToggleActive,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  minBidDollars,
  maxBidDollars,
}: SeedFanRowProps) {
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delay blur so that clicking another element within the row
  // (e.g., toggle button) doesn't trigger a premature save.
  const scheduleBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => onBlur(bid.id), 150);
  }, [bid.id, onBlur]);

  const cancelBlur = useCallback(() => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, bid.id)}
      onDragOver={e => onDragOver(e, bid.id)}
      onDrop={e => onDrop(e, bid.id)}
      onDragEnd={onDragEnd}
      className={`
        flex gap-2 items-start bg-slate-800 rounded-xl p-3 flex-wrap transition-all
        ${!editState.isActive ? 'opacity-40' : ''}
        ${isDragging ? 'opacity-50 scale-[0.97]' : ''}
        ${isDragOver ? 'ring-2 ring-indigo-500/60 ring-offset-1 ring-offset-slate-900' : ''}
        cursor-grab active:cursor-grabbing
      `}
    >
      {/* Drag handle */}
      <span className="flex-shrink-0 w-6 h-8 flex items-center justify-center text-slate-600 select-none text-sm">
        ⠿
      </span>

      {/* Active/inactive toggle */}
      <button
        type="button"
        onMouseDown={cancelBlur}
        onClick={() => onToggleActive(bid.id)}
        title={editState.isActive ? 'Active — click to hide from podium' : 'Hidden — click to show on podium'}
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
          editState.isActive
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
        }`}
      >
        {editState.isActive ? '✓' : '✗'}
      </button>

      <AvatarPicker
        fanHandle={editState.handle}
        value={editState.avatarUrl}
        onChange={(url) => onChange(bid.id, 'avatarUrl', url)}
      />

      <input
        value={editState.handle}
        onChange={e => onChange(bid.id, 'handle', e.target.value)}
        onBlur={scheduleBlur}
        onFocus={cancelBlur}
        placeholder="Handle"
        className="bg-slate-700 text-white rounded-lg px-2 py-1 text-sm w-32 min-w-0"
      />

      <input
        value={editState.message}
        onChange={e => onChange(bid.id, 'message', e.target.value)}
        onBlur={scheduleBlur}
        onFocus={cancelBlur}
        placeholder="Message"
        className="bg-slate-700 text-white rounded-lg px-2 py-1 text-sm flex-1 min-w-0"
      />

      <div className="flex items-center gap-1">
        <span className="text-slate-400 text-sm">$</span>
        <input
          type="number"
          value={editState.amount}
          min={minBidDollars}
          max={maxBidDollars}
          onChange={e => onChange(bid.id, 'amount', Number(e.target.value))}
          onBlur={scheduleBlur}
          onFocus={cancelBlur}
          className="bg-slate-700 text-white rounded-lg px-2 py-1 text-sm w-16"
        />
      </div>

      {/* Save status */}
      <SaveIndicator status={saveStatus} />

      {/* Status messages */}
      {!editState.isActive && !editState.error && (
        <span className="w-full text-slate-500 text-xs">Hidden from podium</span>
      )}
      {editState.error && (
        <span className="w-full text-red-400 text-xs mt-0.5">{editState.error}</span>
      )}
    </div>
  );
}
