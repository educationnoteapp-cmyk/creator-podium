'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, UserX, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'

interface HistoryItem {
  id: string
  action: string
  reason: string | null
  duration_days: number | null
  post_id: string | null
  created_at: string
  admin: { username: string } | null
  post: { title: string } | null
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  warning:      { label: 'אזהרה',     color: 'text-amber-400',  icon: AlertTriangle },
  suspension:   { label: 'השעיה',     color: 'text-red-400',    icon: UserX },
  unsuspend:    { label: 'שחרור',     color: 'text-green-400',  icon: UserX },
  post_hidden:  { label: 'פוסט הוסר', color: 'text-orange-400', icon: EyeOff },
  post_restored:{ label: 'פוסט שוחזר',color: 'text-green-400', icon: Eye },
}

export default function CreatorHistory({ creatorId, creatorName }: { creatorId: string; creatorName: string }) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [reports, setReports] = useState<{ id: string; reason: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const load = async () => {
    if (history.length > 0) { setOpen(o => !o); return }
    setLoading(true)
    const [{ data: hist }, { data: reps }] = await Promise.all([
      supabase.from('creator_moderation_history')
        .select('*, admin:profiles!admin_id(username), post:posts!post_id(title)')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('post_reports')
        .select('id, reason, created_at, post:posts!post_id(title)')
        .in('post_id',
          supabase.from('posts').select('id').eq('creator_id', creatorId) as unknown as string[]
        )
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    if (hist) setHistory(hist)
    if (reps) setReports(reps)
    setLoading(false)
    setOpen(true)
  }

  return (
    <div className="mt-2">
      <button onClick={load}
        className="flex items-center gap-1 text-xs text-muted hover:text-text-main transition-colors">
        {loading ? '...' : open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        היסטוריה ({history.length || '?'})
      </button>

      {open && (
        <div className="mt-2 space-y-1 border-r-2 border-border pr-3 mr-1">
          {history.length === 0 && reports.length === 0 ? (
            <p className="text-xs text-muted">אין היסטוריה</p>
          ) : (
            <>
              {history.map(h => {
                const meta = ACTION_LABELS[h.action] ?? { label: h.action, color: 'text-muted', icon: AlertTriangle }
                const Icon = meta.icon
                return (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <Icon size={11} className={meta.color + ' mt-0.5 flex-shrink-0'} />
                    <div>
                      <span className={meta.color + ' font-medium'}>{meta.label}</span>
                      {h.duration_days && <span className="text-muted"> · {h.duration_days} ימים</span>}
                      {h.reason && <span className="text-muted"> · {h.reason}</span>}
                      {h.post?.title && <span className="text-muted"> · "{h.post.title}"</span>}
                      <div className="text-muted/60 text-[10px]">
                        {new Date(h.created_at).toLocaleDateString('he-IL')} · {h.admin?.username ?? 'מערכת'}
                      </div>
                    </div>
                  </div>
                )
              })}
              {reports.length > 0 && (
                <div className="pt-1 border-t border-border mt-1">
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">דיווחים</p>
                  {reports.map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-xs">
                      <AlertTriangle size={11} className="text-orange-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted">{r.reason ?? 'ללא סיבה'} · {new Date(r.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
