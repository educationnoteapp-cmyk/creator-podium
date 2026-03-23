'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Shield, ShieldCheck } from 'lucide-react'

interface AdminEmail {
  id: string
  email: string
  created_at: string
}

export default function AdminEmails({ adminId }: { adminId: string }) {
  const [admins, setAdmins] = useState<AdminEmail[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('admin_emails')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setAdmins(data)
    }
    load()
  }, [supabase])

  const handleAdd = async () => {
    if (!newEmail.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')

    const { data } = await supabase.rpc('add_admin_by_email', {
      p_admin_id: adminId,
      p_email: newEmail.trim().toLowerCase(),
    })

    if (data?.success) {
      setSuccess(
        data.status === 'updated_existing'
          ? `✓ ${newEmail} עודכן כמנהל מיידית`
          : `✓ ${newEmail} נוסף לרשימה — יקבל הרשאות בהתחברות הבאה`
      )
      setNewEmail('')
      // Refresh list
      const { data: updated } = await supabase.from('admin_emails').select('*').order('created_at', { ascending: false })
      if (updated) setAdmins(updated)
    } else {
      setError(data?.error ?? 'שגיאה')
    }
    setLoading(false)
  }

  const handleRemove = async (email: string) => {
    setLoading(true)
    await supabase.rpc('remove_admin_by_email', {
      p_admin_id: adminId,
      p_email: email,
    })
    setAdmins(prev => prev.filter(a => a.email !== email))
    setLoading(false)
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-background/30">
        <ShieldCheck size={15} className="text-primary" />
        <span className="text-sm font-medium text-text-main">רשימת מנהלים</span>
        <span className="text-xs text-muted bg-white/5 px-2 py-0.5 rounded-full">{admins.length}</span>
      </div>

      {/* Admins list */}
      <div className="divide-y divide-border">
        {admins.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <Shield size={20} className="mx-auto mb-2 opacity-30" />
            אין מנהלים ברשימה עדיין
          </div>
        ) : (
          admins.map(admin => (
            <div key={admin.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <ShieldCheck size={13} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm text-text-main" dir="ltr">{admin.email}</p>
                  <p className="text-xs text-muted">נוסף {new Date(admin.created_at).toLocaleDateString('he-IL')}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(admin.email)}
                disabled={loading}
                className="text-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add new */}
      <div className="px-5 py-4 border-t border-border bg-background/20">
        <p className="text-xs text-muted mb-3">
          הוסף אימייל → ברגע ההתחברות הוא יקבל הרשאות מנהל אוטומטית
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="admin@example.com"
            dir="ltr"
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-main placeholder-muted focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newEmail.trim()}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />
            הוסף
          </button>
        </div>

        {success && <p className="text-xs text-green-400 mt-2">{success}</p>}
        {error && <p className="text-xs text-red-400 mt-2">שגיאה: {error}</p>}
      </div>
    </div>
  )
}
