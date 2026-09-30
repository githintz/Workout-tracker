import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useNotifications } from '../contexts/NotificationsContext'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { MuscleChip } from './ui/Badge'

const TYPE_ICONS = { plan_shared: '📋', plan_accepted: '✅', plan_declined: '✖️' }

function PlanPreview({ planId }) {
  const [days, setDays] = useState(null)
  const [open, setOpen] = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && days === null) {
      const { data } = await supabase.from('workout_days')
        .select('*, day_exercises(exercise_name, order_index)')
        .eq('plan_id', planId).order('day_number')
      setDays(data || [])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={toggle} className="text-accent text-xs font-semibold self-start">
        {open ? 'Hide plan ▲' : 'Preview plan ▼'}
      </button>
      {open && (
        days === null ? <p className="text-[#555] text-xs">Loading…</p>
        : days.length === 0 ? <p className="text-[#555] text-xs">No days in this plan</p>
        : (
          <div className="flex flex-col gap-2 bg-[#1a1a1a] rounded-2xl p-3">
            {days.map(d => (
              <div key={d.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[#555] text-xs w-10 shrink-0">Day {d.day_number}</span>
                  <span className="text-white text-sm flex-1 truncate">{d.title}</span>
                  <div className="flex gap-1">
                    {d.muscle_groups?.slice(0, 2).map(g => <MuscleChip key={g} group={g} />)}
                  </div>
                </div>
                {d.day_exercises?.length > 0 && (
                  <p className="text-[#777] text-xs pl-12">
                    {[...d.day_exercises].sort((a, b) => a.order_index - b.order_index).map(e => e.exercise_name).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function NotificationItem({ n, onDone }) {
  const { acceptShare, declineShare, remove } = useNotifications()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pendingShare = n.type === 'plan_shared' && n.plan_shares?.status === 'pending'
  const shareStatus  = n.type === 'plan_shared' ? n.plan_shares?.status : null

  async function accept() {
    setBusy(true); setError('')
    const { error } = await acceptShare(n.plan_share_id)
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone()
    navigate('/plans')
  }

  async function decline() {
    setBusy(true); setError('')
    const { error } = await declineShare(n.plan_share_id)
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-3 border ${n.read ? 'border-[#1e1e1e] bg-[#111]' : 'border-accent/30 bg-accent/5'}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-base shrink-0">
          {TYPE_ICONS[n.type] || '🔔'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium break-words">{n.title}</p>
          {n.body && <p className="text-[#aaa] text-sm mt-0.5 break-words">{n.body}</p>}
          <p className="text-[#555] text-xs mt-1">
            {n.created_at && formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
            {shareStatus && shareStatus !== 'pending' && <span className="capitalize"> · {shareStatus}</span>}
          </p>
        </div>
        {!pendingShare && (
          <button onClick={() => remove(n.id)} aria-label="Dismiss"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#555] hover:text-white text-lg shrink-0">×</button>
        )}
      </div>

      {pendingShare && (
        <>
          <PlanPreview planId={n.plan_shares.plan_id} />
          <div className="flex gap-2">
            <Button size="sm" onClick={accept} disabled={busy}>{busy ? 'Working…' : 'Add to my plans'}</Button>
            <Button size="sm" variant="secondary" onClick={decline} disabled={busy}>Decline</Button>
          </div>
        </>
      )}
      {error && <p className="text-[#ff4f4f] text-xs">{error}</p>}
    </div>
  )
}

export function NotificationsBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)

  function openPanel() {
    setOpen(true)
    markAllRead()
  }

  return (
    <>
      <button
        onClick={openPanel}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        className="relative h-8 w-8 flex items-center justify-center rounded-full bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]
          hover:border-accent/40 hover:text-accent transition-colors active:scale-95"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-black text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notifications">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="text-4xl">🔔</div>
            <p className="text-white font-semibold">No notifications yet</p>
            <p className="text-[#555] text-sm max-w-xs">When friends share workout plans with you, they'll show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map(n => <NotificationItem key={n.id} n={n} onDone={() => setOpen(false)} />)}
          </div>
        )}
      </Modal>
    </>
  )
}
