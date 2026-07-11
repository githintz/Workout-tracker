import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { SettingsProvider } from '../contexts/SettingsContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageLoader } from '../components/ui/Spinner'
import { format, parseISO } from 'date-fns'
import AnalyticsPage from './AnalyticsPage'

function formatDur(secs) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function SessionCard({ session }) {
  const [open, setOpen] = useState(false)
  const [sets, setSets] = useState(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && sets === null) {
      const { data } = await supabase.from('session_sets').select('*')
        .eq('session_id', session.id).order('exercise_name').order('set_number')
      setSets(data || [])
    }
  }

  const grouped = []
  if (sets) {
    const seen = new Set()
    for (const s of sets) {
      if (seen.has(s.exercise_name)) continue
      seen.add(s.exercise_name)
      grouped.push({ name: s.exercise_name, sets: sets.filter(r => r.exercise_name === s.exercise_name) })
    }
  }

  return (
    <Card onClick={toggle} className="flex flex-col gap-2 cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-lg shrink-0">💪</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{session.day_title || 'Workout'}</p>
          <p className="text-[#444] text-xs">{format(parseISO(session.started_at), 'EEE, MMM d yyyy')}</p>
        </div>
        {session.duration_seconds && (
          <span className="text-[#555] text-xs shrink-0">{formatDur(session.duration_seconds)}</span>
        )}
        <span className="text-[#555] text-xs">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="flex flex-col gap-3 pt-2 border-t border-[#1e1e1e]">
          {sets === null ? (
            <p className="text-[#555] text-sm text-center py-2">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-[#555] text-sm text-center py-2">No sets logged</p>
          ) : grouped.map((g, gi) => (
            <div key={gi}>
              <p className="text-white font-semibold text-sm mb-1">
                {g.name}
                {g.sets[0]?.superset_partner_name && (
                  <span className="text-[#777] font-normal"> + {g.sets[0].superset_partner_name}</span>
                )}
              </p>
              <div className="flex flex-col gap-0.5">
                {g.sets.map((s, si) => (
                  <p key={si} className="text-[#aaa] text-sm">
                    <span className="text-[#555] text-xs mr-2">#{s.set_number}</span>
                    {s.weight ?? '—'}kg × {s.reps ?? '—'}
                    {s.superset_partner_name && <span className="text-[#777]"> · partner {s.partner_weight ?? '—'}kg × {s.partner_reps ?? '—'}</span>}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {session.notes && (
            <div className="bg-[#1a1a1a] rounded-2xl px-3 py-2">
              <p className="text-[#555] text-xs mb-1">Notes</p>
              <p className="text-white text-sm">{session.notes}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

const CARDIO_ICONS = { run: '🏃', walk: '🚶', cycle: '🚴', hiit: '⚡', other: '🏋️' }

export default function PhysioPage({ onExit }) {
  const { user, signOut } = useAuth()
  const [clients, setClients]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [cardio, setCardio]     = useState(null)
  const [tab, setTab]           = useState('Workouts')
  const loading = selected && (sessions === null || cardio === null)

  useEffect(() => {
    supabase.from('shared_access').select('*')
      .ilike('viewer_email', user.email)
      .then(({ data }) => {
        setClients(data || [])
        if (data?.length === 1) setSelected(data[0])
      })
  }, [user])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    Promise.all([
      supabase.from('workout_sessions').select('*')
        .eq('user_id', selected.owner_id).order('started_at', { ascending: false }).limit(50),
      supabase.from('cardio_sessions').select('*')
        .eq('user_id', selected.owner_id).order('date', { ascending: false }).limit(50),
    ]).then(([{ data: w }, { data: c }]) => {
      if (cancelled) return
      setSessions(w || [])
      setCardio(c || [])
    })
    return () => { cancelled = true }
  }, [selected])

  if (clients === null) return <PageLoader />

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-[#1e1e1e]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-accent font-black text-2xl tracking-tighter">LIFT</span>
            <span className="text-[#777] text-sm ml-2">Physio view</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onExit}>Exit</Button>
            <Button size="sm" variant="danger" onClick={signOut}>Sign out</Button>
          </div>
        </div>
        <p className="text-[#555] text-xs mt-1">{user.email} · read-only access</p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-5 flex-1">
        {clients.length === 0 ? (
          <Card className="flex flex-col gap-3 items-center py-10 text-center">
            <div className="text-5xl">🔒</div>
            <p className="text-white font-semibold text-lg">No clients have shared with you</p>
            <p className="text-[#555] text-sm max-w-xs">
              Ask your client to add <span className="text-white">{user.email}</span> under
              Settings → Physiotherapist Access in their app.
            </p>
          </Card>
        ) : (
          <>
            {/* Client selector */}
            {clients.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {clients.map(c => (
                  <button key={c.id} onClick={() => { setSessions(null); setCardio(null); setSelected(c) }}
                    className={`h-10 px-4 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                      selected?.id === c.id ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
                    }`}>
                    {c.owner_email}
                  </button>
                ))}
              </div>
            )}

            {!selected ? (
              <p className="text-[#555] text-sm text-center py-8">Select a client to view their logs</p>
            ) : (
              <>
                <p className="text-[#777] text-xs font-medium uppercase tracking-wider">
                  {selected.owner_email}
                </p>

                {/* Tabs */}
                <div className="flex gap-2">
                  {['Workouts', 'Cardio', 'Analytics'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`h-10 px-5 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                        tab === t ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>

                {tab === 'Analytics' ? (
                  <SettingsProvider>
                    <AnalyticsPage userId={selected.owner_id} readOnly />
                  </SettingsProvider>
                ) : loading ? <PageLoader /> : tab === 'Workouts' ? (
                  sessions.length === 0 ? (
                    <p className="text-[#555] text-sm text-center py-8">No workouts logged yet</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sessions.map(s => <SessionCard key={s.id} session={s} />)}
                    </div>
                  )
                ) : (
                  cardio.length === 0 ? (
                    <p className="text-[#555] text-sm text-center py-8">No cardio logged yet</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {cardio.map(c => (
                        <Card key={c.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-lg shrink-0">
                            {CARDIO_ICONS[c.type] || '🏋️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm capitalize">{c.type}</p>
                            <p className="text-[#444] text-xs">{format(parseISO(c.date), 'EEE, MMM d yyyy')}</p>
                            {c.notes && <p className="text-[#777] text-xs mt-0.5 truncate">{c.notes}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            {c.duration_seconds && <p className="text-[#aaa] text-xs">{formatDur(c.duration_seconds)}</p>}
                            {c.distance_km && <p className="text-[#aaa] text-xs">{c.distance_km} km</p>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
