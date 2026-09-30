import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

const STATUS_STYLES = {
  pending:  'text-[#e8b847] bg-[#e8b847]/10',
  accepted: 'text-[#4fdf7c] bg-[#4fdf7c]/10',
  declined: 'text-[#ff4f4f] bg-[#ff4f4f]/10',
}

// Inside the Android app the page is served from localhost, so invites point at the web app
const APP_URL = import.meta.env.VITE_APP_URL || (Capacitor.isNativePlatform()
  ? 'https://githintz.github.io/Workout-tracker/'
  : window.location.origin + import.meta.env.BASE_URL)

function inviteText(senderEmail, recipientEmail, planName) {
  return `${senderEmail} made you a workout plan "${planName}" in LIFT.\n\n` +
    `Open ${APP_URL} and sign in with ${recipientEmail} — the plan will be waiting under the 🔔 notifications.`
}

export function SharePlanModal({ plan, onClose }) {
  const { user } = useAuth()
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [sentTo, setSentTo]   = useState(null)
  const [shares, setShares]   = useState([])

  const loadShares = useCallback(() => {
    supabase.from('plan_shares').select('*')
      .eq('plan_id', plan.id).order('created_at', { ascending: false })
      .then(({ data }) => setShares(data || []))
  }, [plan.id])

  useEffect(() => { loadShares() }, [loadShares])

  async function send(e) {
    e.preventDefault()
    const to = email.trim().toLowerCase()
    if (!to) return
    if (to === user.email?.toLowerCase()) { setError("That's your own email."); return }
    setBusy(true); setError('')
    const { error } = await supabase.from('plan_shares').insert({
      plan_id: plan.id, plan_name: plan.name,
      sender_id: user.id, sender_email: user.email,
      recipient_email: to, message: message.trim() || null,
    })
    setBusy(false)
    if (error) {
      setError(error.code === '23505' ? 'Already shared with this email and waiting for a response.' : `Could not share: ${error.message}`)
      return
    }
    setSentTo(to); setEmail(''); setMessage('')
    loadShares()
  }

  async function cancelShare(id) {
    await supabase.from('plan_shares').delete().eq('id', id)
    loadShares()
  }

  async function invite(to) {
    const text = inviteText(user.email, to, plan.name)
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: 'LIFT workout plan', text, dialogTitle: 'Invite your friend' })
        return
      } catch (e) {
        if (/cancel/i.test(e?.message || '')) return
        // share sheet unavailable — fall back to email
      }
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'LIFT workout plan', text }); return } catch { /* cancelled */ }
    }
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('I made you a workout plan')}&body=${encodeURIComponent(text)}`
  }

  return (
    <Modal open onClose={onClose} title={`Share "${plan.name}"`}>
      <div className="flex flex-col gap-5">
        <form onSubmit={send} className="flex flex-col gap-3">
          <p className="text-[#777] text-sm">
            Send a copy of this plan to a friend. They'll get a notification and can add it to their own plans.
            Later edits to your plan won't change their copy.
          </p>
          <Input label="Friend's email" type="email" placeholder="friend@example.com"
            value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#777] font-medium">Message (optional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
              placeholder="Here's the plan we talked about 💪"
              className="px-4 py-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
                placeholder:text-[#444] focus:outline-none focus:border-accent/50 resize-none w-full" />
          </div>
          {error && <p className="text-[#ff4f4f] text-sm">{error}</p>}
          <Button type="submit" disabled={busy || !email.trim()}>{busy ? 'Sharing…' : 'Share plan'}</Button>
        </form>

        {sentTo && (
          <div className="flex flex-col gap-2 rounded-2xl p-3 border border-accent/30 bg-accent/5">
            <p className="text-white text-sm font-medium">✓ Shared with {sentTo}</p>
            <p className="text-[#aaa] text-xs">
              If they don't use LIFT yet, send them an invite. They just need to sign in with this email to see the plan.
            </p>
            <Button size="sm" variant="accent" className="self-start" onClick={() => invite(sentTo)}>Send invite</Button>
          </div>
        )}

        {shares.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[#777] text-xs font-medium uppercase tracking-wider">Shared with</p>
            {shares.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-[#1a1a1a] rounded-2xl px-3 py-2">
                <span className="text-white text-sm flex-1 truncate">{s.recipient_email}</span>
                <span className={`text-[10px] font-bold uppercase px-2 h-5 rounded-full flex items-center ${STATUS_STYLES[s.status]}`}>
                  {s.status}
                </span>
                {s.status === 'pending' && (
                  <>
                    <button onClick={() => invite(s.recipient_email)} className="text-accent text-xs font-semibold px-1">Invite</button>
                    <button onClick={() => cancelShare(s.id)} className="text-[#ff4f4f] text-xs font-semibold px-1">Cancel</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
