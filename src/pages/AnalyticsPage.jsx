import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Card } from '../components/ui/Card'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  subMonths, addMonths, isSameDay, getDay,
} from 'date-fns'

const TABS = ['Overview', 'Calendar', 'Exercises', 'Cardio', 'History']

const ACCENT = '#e8ff47'
const MUTED  = '#444'

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-[#777] text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || ACCENT }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Calendar Heatmap ──────────────────────────────────────────────────────────
function CalendarHeatmap({ sessions, cardioSessions, filterMuscle }) {
  const [month, setMonth] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const firstDow = getDay(days[0])

  const hasWorkout = (day) => sessions.some(s => isSameDay(parseISO(s.started_at), day) &&
    (!filterMuscle || s.muscle_groups?.includes(filterMuscle)))
  const hasCardio  = (day) => cardioSessions.some(s => isSameDay(parseISO(s.date), day))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => subMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1e1e1e] text-white">←</button>
        <p className="text-white font-semibold">{format(month, 'MMMM yyyy')}</p>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1e1e1e] text-white">→</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <span key={d} className="text-[#444] text-xs">{d}</span>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const w = hasWorkout(day), c = hasCardio(day)
          const isToday = isSameDay(day, new Date())
          return (
            <div key={day.toISOString()}
              className={`aspect-square rounded-xl flex items-center justify-center text-xs font-medium transition-all relative
                ${isToday ? 'ring-1 ring-[#e8ff47]/50' : ''}
                ${w ? 'bg-[#e8ff47]/20 text-[#e8ff47]' : c ? 'bg-[#4fa8ff]/20 text-[#4fa8ff]' : 'bg-[#1a1a1a] text-[#444]'}`}
            >
              {format(day, 'd')}
              {w && c && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#4fa8ff] rounded-full" />}
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-[#555]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#e8ff47]/30" />Workout</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#4fa8ff]/30" />Cardio</span>
      </div>
    </div>
  )
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ sessions, cardioSessions }) {
  const last30 = sessions.filter(s => new Date(s.started_at) > new Date(Date.now() - 30*86400000))

  const volumeByWeek = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const wk = format(parseISO(s.started_at), 'MMM d')
      map[wk] = (map[wk] || 0) + 1
    })
    return Object.entries(map).slice(-12).map(([week, count]) => ({ week, Workouts: count }))
  }, [sessions])

  const totalSets = sessions.reduce((a, s) => a + (s.set_count || 0), 0)

  const muscleCount = useMemo(() => {
    const map = {}
    sessions.forEach(s => (s.muscle_groups || []).forEach(g => { map[g] = (map[g] || 0) + 1 }))
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name, value]) => ({ name, value }))
  }, [sessions])

  const stats = [
    { label: 'Workouts (30d)', value: last30.length },
    { label: 'Total Sessions', value: sessions.length },
    { label: 'Cardio Sessions', value: cardioSessions.length },
    { label: 'Avg Duration', value: (() => {
      const withDur = sessions.filter(s => s.duration_seconds)
      if (!withDur.length) return '--'
      const avg = withDur.reduce((a,s) => a + s.duration_seconds, 0) / withDur.length
      return `${Math.round(avg/60)}m`
    })() },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Stat pills */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="text-center py-4">
            <p className="text-[#e8ff47] text-3xl font-bold">{s.value}</p>
            <p className="text-[#555] text-xs mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Workout frequency */}
      {volumeByWeek.length > 1 && (
        <Card>
          <p className="text-white font-semibold mb-4">Workout Frequency</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={volumeByWeek} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Workouts" fill={ACCENT} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Muscle frequency */}
      {muscleCount.length > 0 && (
        <Card>
          <p className="text-white font-semibold mb-4">Muscle Group Frequency</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={muscleCount} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Sessions" fill="#4fa8ff" radius={[0,6,6,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ─── Exercises Tab ─────────────────────────────────────────────────────────────
function ExercisesTab({ allSets }) {
  const exercises = useMemo(() => [...new Set(allSets.map(s => s.exercise_name))].sort(), [allSets])
  const [selected, setSelected] = useState('')

  const progression = useMemo(() => {
    if (!selected) return []
    return allSets
      .filter(s => s.exercise_name === selected && s.weight && s.reps)
      .sort((a,b) => new Date(a.completed_at) - new Date(b.completed_at))
      .reduce((acc, s) => {
        const date = format(parseISO(s.completed_at), 'MMM d')
        const last = acc[acc.length - 1]
        if (last?.date === date) {
          if (s.weight > last.Weight) { last.Weight = s.weight; last.Reps = s.reps }
        } else {
          acc.push({ date, Weight: s.weight, Reps: s.reps })
        }
        return acc
      }, [])
  }, [selected, allSets])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[#777] text-sm font-medium mb-2">Select Exercise</p>
        <div className="relative">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full h-12 px-4 pr-10 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
              focus:outline-none focus:border-[#e8ff47]/50 appearance-none"
          >
            <option value="">-- Choose an exercise --</option>
            {exercises.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none">▾</span>
        </div>
      </div>

      {selected && progression.length === 0 && (
        <EmptyState icon="📈" title="Not enough data" subtitle="Log more sets to see progression" />
      )}

      {progression.length > 1 && (
        <>
          <Card>
            <p className="text-white font-semibold mb-4">Weight Progression</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={progression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Weight" stroke={ACCENT} strokeWidth={2.5}
                  dot={{ fill: ACCENT, strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <p className="text-white font-semibold mb-4">Reps Progression</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={progression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Reps" stroke="#4fa8ff" strokeWidth={2.5}
                  dot={{ fill: '#4fa8ff', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Best performance */}
          <Card>
            <p className="text-white font-semibold mb-3">Personal Bests</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
                <p className="text-[#e8ff47] text-2xl font-bold">{Math.max(...progression.map(p => p.Weight))}</p>
                <p className="text-[#555] text-xs mt-1">Max Weight</p>
              </div>
              <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
                <p className="text-[#4fa8ff] text-2xl font-bold">{Math.max(...progression.map(p => p.Reps))}</p>
                <p className="text-[#555] text-xs mt-1">Max Reps</p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── Cardio Tab ────────────────────────────────────────────────────────────────
function CardioTab({ cardioSessions }) {
  const [type, setType] = useState('run')
  const filtered = cardioSessions.filter(s => s.type === type)

  const chartData = useMemo(() => {
    return filtered
      .sort((a,b) => new Date(a.date) - new Date(b.date))
      .map(s => ({
        date: format(parseISO(s.date), 'MMM d'),
        Distance: s.distance_km,
        Duration: s.duration_seconds ? +(s.duration_seconds / 60).toFixed(1) : null,
        Pace: s.distance_km && s.duration_seconds
          ? +(s.duration_seconds / 60 / s.distance_km).toFixed(2) : null,
      }))
  }, [filtered])

  const totalDist = filtered.reduce((a,s) => a + (s.distance_km || 0), 0)
  const totalTime = filtered.reduce((a,s) => a + (s.duration_seconds || 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Type filter */}
      <div className="flex gap-2">
        {['run','hiit','cycle','walk'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`px-4 h-9 rounded-full text-sm font-medium transition-all capitalize ${
              type === t ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
            }`}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🏃" title={`No ${type} sessions`} subtitle="Log some cardio to see analytics" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="text-center py-4">
              <p className="text-[#e8ff47] text-2xl font-bold">{filtered.length}</p>
              <p className="text-[#555] text-xs mt-1">Sessions</p>
            </Card>
            {totalDist > 0 && (
              <Card className="text-center py-4">
                <p className="text-[#e8ff47] text-2xl font-bold">{totalDist.toFixed(1)}</p>
                <p className="text-[#555] text-xs mt-1">Total km</p>
              </Card>
            )}
            {totalTime > 0 && (
              <Card className="text-center py-4">
                <p className="text-[#e8ff47] text-2xl font-bold">{Math.round(totalTime/60)}</p>
                <p className="text-[#555] text-xs mt-1">Total minutes</p>
              </Card>
            )}
          </div>

          {chartData.filter(d => d.Distance).length > 1 && (
            <Card>
              <p className="text-white font-semibold mb-4">Distance Over Time</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Distance" name="Distance (km)" stroke={ACCENT} strokeWidth={2.5}
                    dot={{ fill: ACCENT, strokeWidth: 0, r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {chartData.filter(d => d.Pace).length > 1 && (
            <Card>
              <p className="text-white font-semibold mb-4">Pace (min/km)</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} reversed />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Pace" name="Pace (min/km)" stroke="#4fdf7c" strokeWidth={2.5}
                    dot={{ fill: '#4fdf7c', strokeWidth: 0, r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {type === 'hiit' && (() => {
            const hiitData = filtered.flatMap(s => s.hiit_sets || [])
            if (!hiitData.length) return null
            return (
              <Card>
                <p className="text-white font-semibold mb-3">HIIT Summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
                    <p className="text-[#e8ff47] text-xl font-bold">{Math.max(...hiitData.map(h => h.speed_high || 0))}</p>
                    <p className="text-[#555] text-xs mt-1">Best High Speed</p>
                  </div>
                  <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
                    <p className="text-[#e8ff47] text-xl font-bold">{hiitData.reduce((a,h) => a + (h.reps || 0), 0)}</p>
                    <p className="text-[#555] text-xs mt-1">Total Reps</p>
                  </div>
                </div>
              </Card>
            )
          })()}
        </>
      )}
    </div>
  )
}

// ─── Edit Session Modal ────────────────────────────────────────────────────────
function EditSessionModal({ session, open, onClose, onSaved }) {
  const [sets, setSets]       = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!open || !session) return
    setStartDate(format(parseISO(session.started_at), "yyyy-MM-dd'T'HH:mm"))
    setEndDate(session.ended_at ? format(parseISO(session.ended_at), "yyyy-MM-dd'T'HH:mm") : '')
    setNotes(session.notes || '')
    supabase.from('session_sets').select('*')
      .eq('session_id', session.id).order('exercise_name').order('set_number')
      .then(({ data }) => setSets(data || []))
  }, [open, session])

  const updateSet = (i, field, val) =>
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))

  const removeSet = (i) => setSets(prev => prev.filter((_, idx) => idx !== i))

  const addSet = (exerciseName) => {
    const last = [...sets].reverse().find(s => s.exercise_name === exerciseName)
    setSets(prev => [...prev, {
      id: 'new-' + crypto.randomUUID(),
      session_id: session.id,
      exercise_name: exerciseName,
      set_number: (last?.set_number || 0) + 1,
      weight: last?.weight || null,
      reps: last?.reps || null,
    }])
  }

  const save = async () => {
    setSaving(true)
    const newStart = new Date(startDate)
    const newEnd   = endDate ? new Date(endDate) : null
    const duration = newEnd && newStart ? Math.round((newEnd - newStart) / 1000) : null

    await supabase.from('workout_sessions')
      .update({
        started_at: newStart.toISOString(),
        ended_at: newEnd?.toISOString() || null,
        duration_seconds: duration,
        notes: notes.trim() || null,
      })
      .eq('id', session.id)

    // Delete all old sets and reinsert
    await supabase.from('session_sets').delete().eq('session_id', session.id)
    const rows = sets.filter(s => s.reps || s.weight).map((s) => ({
      session_id: session.id,
      exercise_name: s.exercise_name,
      set_number: s.set_number,
      weight: parseFloat(s.weight) || null,
      reps: parseInt(s.reps) || null,
      superset_partner_name: s.superset_partner_name || null,
      partner_weight: parseFloat(s.partner_weight) || null,
      partner_reps: parseInt(s.partner_reps) || null,
    }))
    if (rows.length) await supabase.from('session_sets').insert(rows)

    setSaving(false)
    onSaved({ ...session, started_at: newStart.toISOString(), ended_at: newEnd?.toISOString() || null, duration_seconds: duration, notes })
    onClose()
  }

  // Group sets by exercise
  const byExercise = sets.reduce((acc, s) => {
    acc[s.exercise_name] = acc[s.exercise_name] || []
    acc[s.exercise_name].push(s)
    return acc
  }, {})

  return (
    <Modal open={open} onClose={onClose} title="Edit Log">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[#777] text-sm font-medium">Start</label>
            <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-12 px-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
                focus:outline-none focus:border-[#e8ff47]/50 w-full" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[#777] text-sm font-medium">End</label>
            <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-12 px-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
                focus:outline-none focus:border-[#e8ff47]/50 w-full" />
          </div>
        </div>

        {Object.entries(byExercise).map(([name, exSets]) => (
          <div key={name} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-sm">{name}</p>
              <button onClick={() => addSet(name)}
                className="text-[#e8ff47] text-xs font-medium">+ set</button>
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="w-5 text-[#555] text-xs">#</span>
              <span className="flex-1 text-center text-[#555] text-xs">Weight</span>
              <span className="flex-1 text-center text-[#555] text-xs">Reps</span>
              <span className="w-7" />
            </div>
            {exSets.map((s, i) => {
              const gi = sets.indexOf(s)
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-[#555] text-xs text-center">{i + 1}</span>
                  <input type="number" inputMode="decimal" value={s.weight ?? ''} placeholder="0"
                    onChange={e => updateSet(gi, 'weight', e.target.value)}
                    className="flex-1 h-10 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-center text-sm focus:outline-none focus:border-[#e8ff47]/50" />
                  <input type="number" inputMode="numeric" value={s.reps ?? ''} placeholder="0"
                    onChange={e => updateSet(gi, 'reps', e.target.value)}
                    className="flex-1 h-10 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-center text-sm focus:outline-none focus:border-[#e8ff47]/50" />
                  <button onClick={() => removeSet(gi)}
                    className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-[#ff4f4f] text-lg">×</button>
                </div>
              )
            })}
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-[#777] text-sm font-medium">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Any notes…"
            className="px-4 py-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
              placeholder:text-[#444] focus:outline-none focus:border-[#e8ff47]/50 resize-none w-full" />
        </div>

        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ sessions, onDelete, onEdit }) {
  function formatDur(secs) {
    if (!secs) return null
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  if (sessions.length === 0) {
    return <EmptyState icon="📋" title="No workout logs yet" subtitle="Finish a workout to see it here" />
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map(s => (
        <Card key={s.id}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1e1e1e] flex items-center justify-center text-xl shrink-0">💪</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{s.day_title || 'Workout'}</p>
                  <p className="text-[#555] text-xs">{s.plan_name || ''}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => onEdit(s)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[#777] hover:bg-[#e8ff47]/10 hover:text-[#e8ff47] transition-colors text-sm">✏️</button>
                  <button onClick={() => onDelete(s.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[#555] hover:bg-[#ff4f4f]/10 hover:text-[#ff4f4f] transition-colors text-lg leading-none">×</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <div>
                  <p className="text-[#555] text-xs">Date</p>
                  <p className="text-white text-sm font-medium">
                    {format(parseISO(s.started_at), 'EEE, MMM d yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-[#555] text-xs">Start</p>
                  <p className="text-white text-sm font-medium">
                    {format(parseISO(s.started_at), 'h:mm a')}
                  </p>
                </div>
                {s.ended_at && (
                  <div>
                    <p className="text-[#555] text-xs">End</p>
                    <p className="text-white text-sm font-medium">
                      {format(parseISO(s.ended_at), 'h:mm a')}
                    </p>
                  </div>
                )}
                {s.duration_seconds && (
                  <div>
                    <p className="text-[#555] text-xs">Duration</p>
                    <p className="text-[#e8ff47] text-sm font-semibold">{formatDur(s.duration_seconds)}</p>
                  </div>
                )}
              </div>

              {s.muscle_groups?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.muscle_groups.map(g => <MuscleChip key={g} group={g} />)}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Analytics Page ───────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user }     = useAuth()
  const { settings } = useSettings()
  const [tab, setTab]  = useState(0)
  const [sessions,  setSessions]  = useState([])
  const [allSets,   setAllSets]   = useState([])
  const [cardio,    setCardio]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filterMuscle, setFilterMuscle] = useState(null)
  const [editSession, setEditSession]   = useState(null)

  const MUSCLE_GROUPS = ['Chest','Back','Shoulders','Biceps','Triceps','Legs','Glutes','Core']

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(200),
      supabase.from('session_sets').select('*, workout_sessions!inner(user_id)').eq('workout_sessions.user_id', user.id).order('completed_at').limit(2000),
      supabase.from('cardio_sessions').select('*, hiit_sets(*)').eq('user_id', user.id).order('date', { ascending: false }).limit(200),
    ]).then(([{ data: s }, { data: sets }, { data: c }]) => {
      setSessions(s || [])
      setAllSets(sets || [])
      setCardio(c || [])
      setLoading(false)
    })
  }, [user])

  const deleteSession = async (id) => {
    if (!confirm('Delete this workout log? This cannot be undone.')) return
    await supabase.from('workout_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <PageLoader />

  const noData = sessions.length === 0 && cardio.length === 0

  if (noData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-6">
        <EmptyState icon="📊" title="No data yet"
          subtitle="Complete a few workouts and log some cardio to see your analytics" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Tab bar */}
      <div className="flex gap-2 px-4 pt-5 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium transition-all ${
              tab === i ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
            }`}>{t}</button>
        ))}
      </div>

      <div className="px-4">
        {tab === 0 && <OverviewTab sessions={sessions} cardioSessions={cardio} />}
        {tab === 1 && (
          <div className="flex flex-col gap-4">
            {/* Muscle filter */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterMuscle(null)}
                className={`px-3 h-8 rounded-full text-xs font-medium transition-all ${
                  !filterMuscle ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
                }`}>All</button>
              {MUSCLE_GROUPS.map(g => (
                <MuscleChip key={g} group={g} active={filterMuscle === g} onClick={() => setFilterMuscle(filterMuscle === g ? null : g)} />
              ))}
            </div>
            <Card>
              <CalendarHeatmap sessions={sessions} cardioSessions={cardio} filterMuscle={filterMuscle} />
            </Card>
          </div>
        )}
        {tab === 2 && <ExercisesTab allSets={allSets} />}
        {tab === 3 && <CardioTab cardioSessions={cardio} />}
        {tab === 4 && <HistoryTab sessions={sessions} onDelete={deleteSession} onEdit={setEditSession} />}
      </div>

      <EditSessionModal
        session={editSession} open={!!editSession}
        onClose={() => setEditSession(null)}
        onSaved={updated => setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))}
      />
    </div>
  )
}
