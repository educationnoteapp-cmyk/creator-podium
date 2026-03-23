'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminActionsProps {
  postId?: string
  creatorId?: string
  action: 'restore' | 'confirm_hide' | 'suspend_7' | 'suspend_30'
  label: string
  className?: string
}

export default function AdminActions({ postId, creatorId, action, label, className }: AdminActionsProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  const handleClick = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    if (action === 'restore' && postId) {
      await supabase.rpc('admin_review_post', { p_admin_id: session.user.id, p_post_id: postId, p_action: 'restore' })
    } else if (action === 'confirm_hide' && postId) {
      await supabase.rpc('admin_review_post', { p_admin_id: session.user.id, p_post_id: postId, p_action: 'confirm_hide' })
    } else if (action === 'suspend_7' && creatorId) {
      await supabase.rpc('suspend_creator', { p_admin_id: session.user.id, p_target_id: creatorId, p_reason: 'הפרת תנאי שימוש', p_days: 7 })
    } else if (action === 'suspend_30' && creatorId) {
      await supabase.rpc('suspend_creator', { p_admin_id: session.user.id, p_target_id: creatorId, p_reason: 'הפרות חוזרות', p_days: 30 })
    }

    setLoading(false)
    setDone(true)
    setTimeout(() => window.location.reload(), 800)
  }

  return (
    <button onClick={handleClick} disabled={loading || done} className={className + ' disabled:opacity-50'}>
      {done ? '✓' : loading ? '...' : label}
    </button>
  )
}
