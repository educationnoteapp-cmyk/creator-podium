'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SeedFanRow from './SeedFanRow';
import type { SeedEditState } from './SeedFanRow';
import type { Bid } from '@/types';

// ── Props ────────────────────────────────────────────────────────────────────
interface DemoFansSectionProps {
  seedBids: Bid[];
  realFansOnPodium: number;
  minBidDollars: number;
  maxBidDollars: number;
  creatorId: string;
  onRefresh: () => Promise<void>;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DemoFansSection({
  seedBids,
  realFansOnPodium,
  minBidDollars,
  maxBidDollars,
  creatorId,
  onRefresh,
}: DemoFansSectionProps) {
  // ── Edit state per bid ───────────────────────────────────────────────────
  const [editRows, setEditRows] = useState<Record<string, SeedEditState>>({});
  const [fanSaveStatus, setFanSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Refs for stale-closure-safe access in debounced callbacks
  const editRowsRef = useRef(editRows);
  editRowsRef.current = editRows;

  const draggingIdRef = useRef<string | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Sync editRows from seedBids (server data → local state) ─────────────
  // Always repopulate from fresh server data, EXCEPT rows with a pending
  // debounce timer (user is actively typing — don't overwrite their input).
  useEffect(() => {
    setEditRows(prev => {
      const next = { ...prev };
      for (const b of seedBids) {
        if (!debounceTimers.current[b.id]) {
          next[b.id] = {
            handle: b.fan_handle,
            message: b.message ?? '',
            amount: b.amount_paid / 100,
            avatarUrl: b.fan_avatar_url,
            isActive: b.is_active !== false,
            error: '',
          };
        }
      }
      const validIds = new Set(seedBids.map(b => b.id));
      for (const key of Object.keys(next)) {
        if (!validIds.has(key)) delete next[key];
      }
      return next;
    });
  }, [seedBids]);

  // ── Cleanup debounce timers on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      for (const t of Object.values(debounceTimers.current)) clearTimeout(t);
    };
  }, []);

  // ── Save a single fan to the API ───────────────────────────────────────
  const saveFan = useCallback(async (bidId: string, amountOverride?: number) => {
    const row = editRowsRef.current[bidId];
    if (!row) return;

    if (!row.handle.trim()) {
      setEditRows(prev => ({ ...prev, [bidId]: { ...prev[bidId], error: 'Handle required' } }));
      return;
    }

    setFanSaveStatus(prev => ({ ...prev, [bidId]: 'saving' }));

    const res = await fetch('/api/dashboard/seed/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bidId,
        fanHandle: row.handle,
        message: row.message,
        fanAvatarUrl: row.avatarUrl,
        amountDollars: amountOverride ?? row.amount,
        isActive: row.isActive,
      }),
    });

    if (res.ok) {
      setFanSaveStatus(prev => ({ ...prev, [bidId]: 'saved' }));
      setTimeout(() => setFanSaveStatus(prev => { const n = { ...prev }; delete n[bidId]; return n; }), 2000);
      setEditRows(prev => { const n = { ...prev }; delete n[bidId]; return n; });
      await onRefresh();
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setFanSaveStatus(prev => ({ ...prev, [bidId]: 'error' }));
      setEditRows(prev => ({ ...prev, [bidId]: { ...prev[bidId], error: body.error ?? 'Save failed' } }));
      setTimeout(() => setFanSaveStatus(prev => { const n = { ...prev }; delete n[bidId]; return n; }), 3000);
    }
  }, [onRefresh]);

  // ── Field change with 800ms debounce ───────────────────────────────────
  const handleRowChange = useCallback((
    bidId: string,
    field: keyof Omit<SeedEditState, 'error' | 'isActive'>,
    value: string | number | null,
  ) => {
    setEditRows(prev => ({
      ...prev,
      [bidId]: { ...prev[bidId], [field]: value, error: '' },
    }));
    clearTimeout(debounceTimers.current[bidId]);
    debounceTimers.current[bidId] = setTimeout(() => saveFan(bidId), 800);
  }, [saveFan]);

  // ── Blur → immediate save (cancel pending debounce) ────────────────────
  const handleBlur = useCallback((bidId: string) => {
    if (debounceTimers.current[bidId]) {
      clearTimeout(debounceTimers.current[bidId]);
      delete debounceTimers.current[bidId];
      saveFan(bidId);
    }
  }, [saveFan]);

  // ── Toggle active/inactive → immediate save ───────────────────────────
  const handleToggleActive = useCallback(async (bidId: string) => {
    const row = editRowsRef.current[bidId];
    if (!row) return;
    const newIsActive = !row.isActive;

    // Cancel pending debounce
    clearTimeout(debounceTimers.current[bidId]);
    delete debounceTimers.current[bidId];

    // Optimistic update
    setEditRows(prev => ({ ...prev, [bidId]: { ...prev[bidId], isActive: newIsActive } }));
    setFanSaveStatus(prev => ({ ...prev, [bidId]: 'saving' }));

    const res = await fetch('/api/dashboard/seed/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bidId,
        isActive: newIsActive,
        fanHandle: row.handle,
        message: row.message,
        fanAvatarUrl: row.avatarUrl,
        amountDollars: row.amount,
      }),
    });

    if (res.ok) {
      setFanSaveStatus(prev => ({ ...prev, [bidId]: 'saved' }));
      setTimeout(() => setFanSaveStatus(prev => { const n = { ...prev }; delete n[bidId]; return n; }), 2000);
      setEditRows(prev => { const n = { ...prev }; delete n[bidId]; return n; });
      await onRefresh();
    } else {
      setFanSaveStatus(prev => ({ ...prev, [bidId]: 'error' }));
      setEditRows(prev => ({ ...prev, [bidId]: { ...prev[bidId], isActive: !newIsActive } }));
      setTimeout(() => setFanSaveStatus(prev => { const n = { ...prev }; delete n[bidId]; return n; }), 3000);
    }
  }, [onRefresh]);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, bidId: string) => {
    draggingIdRef.current = bidId;
    setDraggingId(bidId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, bidId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(bidId);
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, targetBidId: string) => {
    e.preventDefault();
    const fromId = draggingIdRef.current;
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);

    if (!fromId || fromId === targetBidId) return;

    // seedBids is sorted by amount_paid descending
    const draggedBid = seedBids.find(b => b.id === fromId);
    if (!draggedBid) return;

    // Build list without dragged item
    const withoutDragged = seedBids.filter(b => b.id !== fromId);
    const insertAt = withoutDragged.findIndex(b => b.id === targetBidId);
    if (insertAt === -1) return;

    const aboveCents = withoutDragged[insertAt - 1]?.amount_paid;
    const belowCents = withoutDragged[insertAt]?.amount_paid;

    let newCents: number;
    if (aboveCents === undefined) {
      // Moving to top
      newCents = (belowCents ?? maxBidDollars * 100) + 100;
    } else if (belowCents === undefined) {
      // Moving to bottom
      newCents = aboveCents - 100;
    } else {
      newCents = Math.round((aboveCents + belowCents) / 2);
    }

    // Clamp to valid range
    newCents = Math.max(minBidDollars * 100, Math.min(maxBidDollars * 100, newCents));
    const newDollars = newCents / 100;

    // Use editRowsRef for live unsaved edits, fall back to committed server data
    const row = editRowsRef.current[fromId];
    const handle    = row?.handle    ?? draggedBid.fan_handle;
    const message   = row?.message   ?? draggedBid.message ?? '';
    const avatarUrl = row?.avatarUrl ?? draggedBid.fan_avatar_url;
    const isActive  = row?.isActive  ?? (draggedBid.is_active !== false);

    // Optimistic local update
    setEditRows(prev => ({
      ...prev,
      [fromId]: { ...(row ?? { handle, message, avatarUrl, isActive, error: '' }), amount: newDollars },
    }));

    setFanSaveStatus(prev => ({ ...prev, [fromId]: 'saving' }));
    const res = await fetch('/api/dashboard/seed/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidId: fromId, fanHandle: handle, message, fanAvatarUrl: avatarUrl, amountDollars: newDollars, isActive }),
    });
    if (res.ok) {
      setFanSaveStatus(prev => ({ ...prev, [fromId]: 'saved' }));
      setTimeout(() => setFanSaveStatus(prev => { const n = { ...prev }; delete n[fromId]; return n; }), 2000);
      setEditRows(prev => { const n = { ...prev }; delete n[fromId]; return n; });
      await onRefresh();
    } else {
      setFanSaveStatus(prev => ({ ...prev, [fromId]: 'error' }));
      setTimeout(() => setFanSaveStatus(prev => { const n = { ...prev }; delete n[fromId]; return n; }), 3000);
    }
  }, [seedBids, minBidDollars, maxBidDollars, onRefresh]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-0.5">🎭 Manage Demo Fans</h2>
        <p className="text-slate-400 text-sm">
          Edit your demo fans below — changes save automatically. Drag to reorder.
        </p>
      </div>

      {realFansOnPodium > 0 && (
        <p className="text-sm text-emerald-400 font-medium">
          🎉 {realFansOnPodium} real fan{realFansOnPodium !== 1 ? 's' : ''} have joined your podium
        </p>
      )}

      <div className="space-y-2">
        {seedBids.map((bid) => {
          const row = editRows[bid.id] ?? {
            handle: bid.fan_handle,
            message: bid.message ?? '',
            amount: bid.amount_paid / 100,
            avatarUrl: bid.fan_avatar_url,
            isActive: bid.is_active !== false,
            error: '',
          };
          return (
            <SeedFanRow
              key={bid.id}
              bid={bid}
              editState={row}
              saveStatus={fanSaveStatus[bid.id]}
              onChange={handleRowChange}
              onBlur={handleBlur}
              onToggleActive={handleToggleActive}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragging={draggingId === bid.id}
              isDragOver={dragOverId === bid.id}
              minBidDollars={minBidDollars}
              maxBidDollars={maxBidDollars}
            />
          );
        })}
      </div>
    </div>
  );
}
