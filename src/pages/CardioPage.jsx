import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input, NumberInput } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { format, parseISO } from 'date-fns'
import { writeCardioSession } from '../lib/healthConnect'

const TYPE_ICONS = { run: '🏃', hiit: '⚡', cycle: '🚴', walk: '🚶', other: '🏋️' }
const TYPE_LABELS = { run: 'Run', hiit: 'HIIT', cycle: 'Cycle', walk: 'Walk', other: 'Other' }

function formatDuration(secs) {
  if (!secs) return '--'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

export default function CardioPage() {
  const { user }   = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [type, setType]         = useState('run')
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [durMin, setDurMin]     = useState('')
  const [durSec, setDurSec]     = useState('0')
  const [distance, setDistance] = useState('')
  const [notes, setNotes]       = useState('')
  // HIIT
  const [speedHigh, setSpeedHigh]   = useState('')
  const [speedLow, setSpeedLow]     = useState('')
  const [highDur, setHighDur]       = useState('')
  const [lowDur, setLowDur]         = useState('')
  const [hiitReps, setHiitReps]     = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => { loadSessions() }, [user])

  async function loadSessions() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('cardio_sessions')
      .select('*, hiit_sets(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(50)
    setSessions(data || [])
    setLoading(false)
  }

  const resetForm = () => {
    setType('run'); setDate(format(new Date(), 'yyyy-MM-dd'))
    setDurMin(''); setDurSec('0'); setDistance(''); setNotes('')
    setSpeedHigh(''); setSpeedLow(''); setHighDur(''); setLowDur(''); setHiitReps('')
  }

  const save = async () => {
    setSaving(true)
    const duration = (parseInt(durMin || 0) * 60) + parseInt(durSec || 0)
    const { data: cardio } = await supabase.from('cardio_sessions').insert({
      user_id: user.id, type, date,
      duration_seconds: duration || null,
      distance_km: parseFloat(distance) || null,
      notes: notes.trim() || null,
    }).select().single()

    if (type === 'hiit' && cardio) {
      await supabase.from('hiit_sets').insert({
        cardio_session_id: cardio.id,
        speed_high: parseFloat(speedHigh) || null,
        speed_low: parseFloat(speedLow) || null,
        high_duration_seconds: parseInt(highDur) || null,
        low_duration_seconds: parseInt(lowDur) || null,
        reps: parseInt(hiitReps) || null,
      })
    }

    if (cardio) writeCardioSession(cardio).catch(() => {})

    setSaving(false)
    resetForm()
    setShowModal(false)
    loadSessions()
  }

  const deleteSession = async (id) => {
    if (!confirm('Delete this session?')) return
    await supabase.from('cardio_sessions').delete().eq('id', id)
    setSessions(s => s.filter(x => x.id !== id))
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Cardio</h1>
        <Button size="sm" onClick={() => setShowModal(true)}>+ Log</Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon="🏃" title="No cardio logged" subtitle="Track your runs, cycles, and HIIT sessions"
          action={<Button onClick={() => setShowModal(true)}>Log Cardio</Button>} />
      ) : (
        sessions.map(s => (
          <Card key={s.id}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{TYPE_ICONS[s.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold">{TYPE_LABELS[s.type]}</p>
                  <button onClick={() => deleteSession(s.id)} className="text-[#444] hover:text-[#ff4f4f] text-lg">×</button>
                </div>
                <p className="text-[#555] text-xs">{format(parseISO(s.date), 'EEE, MMM d yyyy')}</p>
                <div className="flex gap-4 mt-2">
                  {s.duration_seconds && (
                    <div>
                      <p className="text-[#777] text-xs">Duration</p>
                      <p className="text-white font-semibold text-sm">{formatDuration(s.duration_seconds)}</p>
                    </div>
                  )}
                  {s.distance_km && (
                    <div>
                      <p className="text-[#777] text-xs">Distance</p>
                      <p className="text-white font-semibold text-sm">{s.distance_km} km</p>
                    </div>
                  )}
                  {s.distance_km && s.duration_seconds && (
                    <div>
                      <p className="text-[#777] text-xs">Pace</p>
                      <p className="text-white font-semibold text-sm">
                        {(s.duration_seconds / 60 / s.distance_km).toFixed(2)} min/km
                      </p>
                    </div>
                  )}
                </div>
                {s.type === 'hiit' && s.hiit_sets?.[0] && (() => {
                  const h = s.hiit_sets[0]
                  return (
                    <div className="mt-2 bg-[#e8ff47]/5 border border-[#e8ff47]/10 rounded-xl p-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                      {h.speed_high && <p className="text-[#777] text-xs">High: <span className="text-white">{h.speed_high} km/h</span></p>}
                      {h.speed_low  && <p className="text-[#777] text-xs">Low: <span className="text-white">{h.speed_low} km/h</span></p>}
                      {h.high_duration_seconds && <p className="text-[#777] text-xs">On: <span className="text-white">{h.high_duration_seconds}s</span></p>}
                      {h.low_duration_seconds  && <p className="text-[#777] text-xs">Off: <span className="text-white">{h.low_duration_seconds}s</span></p>}
                      {h.reps && <p className="text-[#777] text-xs">Reps: <span className="text-white">{h.reps}</span></p>}
                    </div>
                  )
                })()}
                {s.notes && <p className="text-[#555] text-xs mt-2 italic">{s.notes}</p>}
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Log Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Log Cardio">
        <div className="flex flex-col gap-4">
          {/* Type */}
          <div>
            <p className="text-[#777] text-sm font-medium mb-2">Type</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => setType(k)}
                  className={`px-4 h-10 rounded-2xl text-sm font-medium transition-all ${
                    type === k ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
                  }`}>
                  {TYPE_ICONS[k]} {v}
                </button>
              ))}
            </div>
          </div>

          <Input type="date" label="Date" value={date} onChange={e => setDate(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Duration (min)" placeholder="30" value={durMin} onChange={e => setDurMin(e.target.value)} />
            <NumberInput label="Seconds" placeholder="0" value={durSec} onChange={e => setDurSec(e.target.value)} />
          </div>

          {(type === 'run' || type === 'cycle' || type === 'walk') && (
            <NumberInput label="Distance (km)" placeholder="5.0" value={distance} onChange={e => setDistance(e.target.value)} />
          )}

          {type === 'hiit' && (
            <div className="flex flex-col gap-3 bg-[#1a1a1a] border border-[#e8ff47]/20 rounded-2xl p-4">
              <p className="text-[#e8ff47] text-xs font-bold uppercase">HIIT Details</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Speed high (km/h)" placeholder="14" value={speedHigh} onChange={e => setSpeedHigh(e.target.value)} />
                <NumberInput label="Speed low (km/h)"  placeholder="8"  value={speedLow}  onChange={e => setSpeedLow(e.target.value)} />
                <NumberInput label="On duration (sec)" placeholder="30" value={highDur} onChange={e => setHighDur(e.target.value)} />
                <NumberInput label="Off duration (sec)" placeholder="60" value={lowDur} onChange={e => setLowDur(e.target.value)} />
                <NumberInput label="Reps" placeholder="8" value={hiitReps} onChange={e => setHiitReps(e.target.value)} />
              </div>
            </div>
          )}

          <Input label="Notes (optional)" placeholder="Felt great…" value={notes} onChange={e => setNotes(e.target.value)} />

          <Button size="lg" className="w-full" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Session'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
