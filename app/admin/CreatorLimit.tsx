'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Save, Check } from 'lucide-react'

export default function CreatorLimit({ adminId }: { adminId: string }) {
  const [limit, setLimit] = useState(250)
  const [current, setCurrent] = useState(0)
  const [inputVal, setInputVal] = useState('250')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const [{ data: setting }, { count }] = await Promise.all([
        supabase.from('system_settings').select('value').eq('key', 'max_creators').single(),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).not('last_post_at', 'is', null),
      ])
      if (setting) { setLimit(parseInt(setting.value)); setInputVal(setting.value) }
      if (count !== null) setCurrent(count)
    }
    load()
  }, [supabase])

  const handleSave = async () => {
    const val = parseInt(inputVal)
    if (isNaN(val) || val < 1) return
    setSaving(true)
    await supabase.from('system_settings').upsert({ key: 'max_creators', value: String(val), description: 'מספר מקסימלי של יוצרים', updated_at: new Date().toISOString() })
    setLimit(val)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const pct = Math.round((current / limit) * 100)

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-background/30">
        <Users size={15} className="text-primary" />
        <span className="text-sm font-medium text-text-main">הגבלת יוצרים</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">יוצרים פעילים</span>
            <span className="text-sm font-bold text-text-main">{current} / {limit}</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div
              className={'h-full rounded-full transition-all ' + (pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-primary')}
              style={{ width: Math.min(100, pct) + '%' }}
            />
          </div>
          <p className="text-xs text-muted mt-1">{pct}% מלא · {Math.max(0, limit - current)} מקומות פנויים</p>
        </div>

        {/* Edit limit */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted flex-shrink-0">מגבלה מקסימלית:</label>
          <input
            type="number"
            min={current}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-main focus:outline-none focus:border-primary/50 text-center"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {saved ? <><Check size={12} /> נשמר</> : <><Save size={12} /> {saving ? '...' : 'שמור'}</>}
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          כשמגיעים למגבלה — אנשים חדשים שמנסים לפרסם יראו הודעה שהפלטפורמה ב-Early Access ויוכלו להצטרף לרשימת המתנה.
        </p>
      </div>
    </div>
  )
}
