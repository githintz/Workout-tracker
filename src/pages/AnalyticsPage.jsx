import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Card } from '../components/ui/Card'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Capacitor } from '@capacitor/core'
import { readStepsHistory, hasPermissions } from '../lib/healthConnect'
import { getAccent } from '../lib/theme'
import { exerciseKey, formatDuration, setDisplayValue, partnerDisplayValue } from '../lib/exercises'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  subMonths, addMonths, isSameDay, getDay,
} from 'date-fns'

const TABS = ['Overview', 'Calendar', 'Exercises', 'Cardio', 'History']

const MUTED  = '#444'

// Blank means "not logged"; 0 is a real value, so avoid `parseFloat(x) || null`
const hasValue  = (v) => String(v ?? '').trim() !== ''
const numOrNull = (v) => {
  if (!hasValue(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function ExerciseNote({ note }) {
  if (!note) return null
  return <p className="text-[#777] text-xs italic bg-[#1a1a1a] rounded-xl px-3 py-2 mt-1">📝 {note}</p>
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-[#777] text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || getAccent() }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────
function SessionDetailModal({ session, open, onClose, onEdit }) {
  const { settings } = useSettings()
  const unit = settings.weight_unit || 'kg'
  const [sets, setSets]   = useState([])
  const [notes, setNotes] = useState({})   // exercise_name => note
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !session) return
    setLoading(true)
    Promise.all([
      supabase.from('session_sets').select('*')
        .eq('session_id', session.id).order('exercise_name').order('set_number'),
      supabase.from('session_exercise_notes').select('exercise_name, note')
        .eq('session_id', session.id),
    ]).then(([{ data }, { data: noteRows }]) => {
      setSets(data || [])
      setNotes(Object.fromEntries((noteRows || []).map(n => [n.exercise_name, n.note])))
      setLoading(false)
    })
  }, [open, session])

  function formatDur(secs) {
    if (!secs) return null
    const m = Math.floor(secs / 60), s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const grouped = []
  const seen = new Set()
  for (const s of sets) {
    if (seen.has(s.exercise_name)) continue
    seen.add(s.exercise_name)
    const exSets = sets.filter(r => r.exercise_name === s.exercise_name)
    if (s.superset_partner_name) {
      grouped.push({ type: 'superset', nameA: s.exercise_name, nameB: s.superset_partner_name, sets: exSets })
    } else {
      grouped.push({ type: 'single', name: s.exercise_name, sets: exSets })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={session?.day_title || 'Workout'}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {session && <>
            <div>
              <p className="text-[#555] text-xs">Date</p>
              <p className="text-white text-sm font-medium">{format(parseISO(session.started_at), 'EEE, MMM d yyyy')}</p>
            </div>
            <div>
              <p className="text-[#555] text-xs">Start</p>
              <p className="text-white text-sm font-medium">{format(parseISO(session.started_at), 'h:mm a')}</p>
            </div>
            {session.ended_at && (
              <div>
                <p className="text-[#555] text-xs">End</p>
                <p className="text-white text-sm font-medium">{format(parseISO(session.ended_at), 'h:mm a')}</p>
              </div>
            )}
            {session.duration_seconds && (
              <div>
                <p className="text-[#555] text-xs">Duration</p>
                <p className="text-accent text-sm font-semibold">{formatDur(session.duration_seconds)}</p>
              </div>
            )}
          </>}
        </div>

        {session?.muscle_groups?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {session.muscle_groups.map(g => <MuscleChip key={g} group={g} />)}
          </div>
        )}

        {loading ? (
          <p className="text-[#555] text-sm text-center py-4">Loading…</p>
        ) : grouped.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-4">No sets logged</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-1.5">
                {g.type === 'superset' ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{g.nameA}</p>
                      <span className="text-accent text-xs bg-accent/10 px-2 h-5 rounded-full flex items-center font-bold shrink-0">SS</span>
                      <p className="text-white font-semibold text-sm">{g.nameB}</p>
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <span className="w-5 text-[#555] text-xs">#</span>
                      <span className="flex-1 text-center text-[#555] text-xs">A ({g.nameA.split(' ')[0]})</span>
                      <span className="flex-1 text-center text-[#555] text-xs">B ({g.nameB.split(' ')[0]})</span>
                    </div>
                    {g.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-[#555] text-xs text-center">{s.set_number}</span>
                        <span className="flex-1 text-center text-white font-medium">{s.weight ?? '—'}{unit} × {setDisplayValue(s)}</span>
                        <span className="flex-1 text-center text-[#aaa]">{s.partner_weight ?? '—'}{unit} × {partnerDisplayValue(s)}</span>
                      </div>
                    ))}
                    <ExerciseNote note={notes[g.nameA]} />
                    <ExerciseNote note={notes[g.nameB]} />
                  </>
                ) : (
                  <>
                    <p className="text-white font-semibold text-sm">{g.name}</p>
                    {g.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-[#555] text-xs text-center">{s.set_number}</span>
                        <span className="text-white font-medium">
                          {s.weight ?? '—'}{unit} × {setDisplayValue(s)}{s.metric === 'time' ? '' : ' reps'}
                        </span>
                      </div>
                    ))}
                    <ExerciseNote note={notes[g.name]} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {session?.notes && (
          <div className="bg-[#1a1a1a] rounded-2xl px-3 py-2">
            <p className="text-[#555] text-xs mb-1">Notes</p>
            <p className="text-white text-sm">{session.notes}</p>
          </div>
        )}

        <Button size="lg" className="w-full" onClick={() => { onClose(); onEdit(session) }}>
          Edit this workout
        </Button>
      </div>
    </Modal>
  )
}

// ─── Calendar Heatmap ──────────────────────────────────────────────────────────
function CalendarHeatmap({ sessions, cardioSessions, filterMuscle, onSessionClick }) {
  const [month, setMonth] = useState(new Date())
  const [selDay, setSelDay] = useState(null)
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const firstDow = getDay(days[0])

  const hasWorkout = (day) => sessions.some(s => isSameDay(parseISO(s.started_at), day) &&
    (!filterMuscle || s.muscle_groups?.includes(filterMuscle)))
  const hasCardio  = (day) => cardioSessions.some(s => isSameDay(parseISO(s.date), day))

  const daySessions = selDay ? sessions.filter(s => isSameDay(parseISO(s.started_at), selDay)) : []
  const dayCardio   = selDay ? cardioSessions.filter(s => isSameDay(parseISO(s.date), selDay)) : []

  function formatDur(secs) {
    if (!secs) return null
    const m = Math.floor(secs / 60)
    return m > 0 ? `${m}m` : `${secs}s`
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => subMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1e1e1e] text-white">←</button>
        <p className="text-white font-semibold">{format(month, 'MMMM yyyy')}</p>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1e1e1e] text-white">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <span key={d} className="text-[#444] text-xs">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const w = hasWorkout(day), c = hasCardio(day)
          const isToday = isSameDay(day, new Date())
          const isSel   = selDay && isSameDay(selDay, day)
          return (
            <button key={day.toISOString()}
              onClick={() => (w || c) && setSelDay(isSel ? null : day)}
              className={`aspect-square rounded-xl flex items-center justify-center text-xs font-medium transition-all relative
                ${isToday ? 'ring-1 ring-accent/50' : ''}
                ${isSel ? 'ring-2 ring-white/40' : ''}
                ${w ? 'bg-accent/20 text-accent' : c ? 'bg-[#4fa8ff]/20 text-[#4fa8ff]' : 'bg-[#1a1a1a] text-[#444]'}
                ${(w || c) ? 'active:scale-90' : 'cursor-default'}`}
            >
              {format(day, 'd')}
              {w && c && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#4fa8ff] rounded-full" />}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-[#555]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/30" />Workout</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#4fa8ff]/30" />Cardio</span>
      </div>

      {selDay && (daySessions.length > 0 || dayCardio.length > 0) && (
        <div className="bg-[#1a1a1a] rounded-2xl p-3 flex flex-col gap-2">
          <p className="text-[#555] text-xs font-medium">{format(selDay, 'EEEE, MMM d')}</p>
          {daySessions.map(s => (
            <button key={s.id} onClick={() => onSessionClick(s)}
              className="flex items-center justify-between py-2 border-b border-[#222] last:border-0 text-left active:opacity-70">
              <div>
                <p className="text-white text-sm font-medium">{s.day_title || 'Workout'}</p>
                <p className="text-[#555] text-xs">{s.plan_name}{s.duration_seconds ? ` · ${formatDur(s.duration_seconds)}` : ''}</p>
              </div>
              <span className="text-accent text-xs shrink-0">View →</span>
            </button>
          ))}
          {dayCardio.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
              <div>
                <p className="text-white text-sm font-medium capitalize">{s.type}</p>
                <p className="text-[#555] text-xs">{[s.distance_km && `${s.distance_km} km`, s.duration_seconds && formatDur(s.duration_seconds)].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="text-[#4fa8ff] text-xs">Cardio</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ sessions, cardioSessions, stepsHistory }) {
  const last30 = sessions.filter(s => new Date(s.started_at) > new Date(Date.now() - 30*86400000))

  const { currentStreak, longestStreak } = useMemo(() => {
    const allDates = new Set([
      ...sessions.map(s => s.started_at.split('T')[0]),
      ...cardioSessions.map(s => s.date),
    ])
    const sorted = [...allDates].sort()
    if (!sorted.length) return { currentStreak: 0, longestStreak: 0 }

    let longest = 1, streak = 1
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((new Date(sorted[i]) - new Date(sorted[i-1])) / 86400000)
      if (diff === 1) { streak++; if (streak > longest) longest = streak }
      else streak = 1
    }
    longest = Math.max(longest, streak)

    const today = new Date().toISOString().split('T')[0]
    const last = sorted[sorted.length - 1]
    const daysSinceLast = Math.round((new Date(today) - new Date(last)) / 86400000)
    let current = 0
    if (daysSinceLast <= 1) {
      current = 1
      for (let i = sorted.length - 2; i >= 0; i--) {
        if (Math.round((new Date(sorted[i+1]) - new Date(sorted[i])) / 86400000) === 1) current++
        else break
      }
    }
    return { currentStreak: current, longestStreak: longest }
  }, [sessions, cardioSessions])

  const weeklySummary = useMemo(() => {
    const result = []
    for (let i = 3; i >= 0; i--) {
      const end = new Date(); end.setHours(23, 59, 59, 999)
      const endCopy = new Date(end); endCopy.setDate(endCopy.getDate() - i * 7)
      const startCopy = new Date(endCopy); startCopy.setDate(startCopy.getDate() - 6); startCopy.setHours(0,0,0,0)
      const label = i === 0 ? 'This wk' : i === 1 ? 'Last wk' : `${i + 1}w ago`
      const wSessions = sessions.filter(s => { const d = new Date(s.started_at); return d >= startCopy && d <= endCopy }).length
      const wCardio   = cardioSessions.filter(s => { const d = new Date(s.date); return d >= startCopy && d <= endCopy }).length
      result.push({ label, Workouts: wSessions, Cardio: wCardio })
    }
    return result
  }, [sessions, cardioSessions])

  const stepsChartData = useMemo(() => {
    if (!stepsHistory || !Object.keys(stepsHistory).length) return []
    return Object.entries(stepsHistory)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, steps]) => ({ date: format(parseISO(date), 'MMM d'), Steps: steps }))
  }, [stepsHistory])

  const volumeByWeek = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const wk = format(parseISO(s.started_at), 'MMM d')
      map[wk] = (map[wk] || 0) + 1
    })
    return Object.entries(map).slice(-12).map(([week, count]) => ({ week, Workouts: count }))
  }, [sessions])

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
            <p className="text-accent text-3xl font-bold">{s.value}</p>
            <p className="text-[#555] text-xs mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Streak cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <p className="text-[#4fdf7c] text-3xl font-bold">{currentStreak}</p>
          <p className="text-[#555] text-xs mt-1">Current Streak</p>
          <p className="text-[#333] text-xs">{currentStreak === 1 ? 'day' : 'days'}</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-[#4fa8ff] text-3xl font-bold">{longestStreak}</p>
          <p className="text-[#555] text-xs mt-1">Longest Streak</p>
          <p className="text-[#333] text-xs">{longestStreak === 1 ? 'day' : 'days'}</p>
        </Card>
      </div>

      {/* Weekly summary */}
      <Card>
        <p className="text-white font-semibold mb-4">Weekly Summary</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={weeklySummary} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Workouts" fill={getAccent()} radius={[4,4,0,0]} />
            <Bar dataKey="Cardio" fill="#4fa8ff" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-[#555]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-accent/60 inline-block" />Workouts</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#4fa8ff]/60 inline-block" />Cardio</span>
        </div>
      </Card>

      {/* Steps history — only shown when data is available */}
      {stepsChartData.length > 1 && (
        <Card>
          <p className="text-white font-semibold mb-4">Steps (last 14 days)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stepsChartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Steps" fill="#4fdf7c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

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
              <Bar dataKey="Workouts" fill={getAccent()} radius={[6,6,0,0]} />
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
function ExercisesTab({ allSets, planExercises, onRenamed }) {
  const { settings } = useSettings()
  const unit = settings.weight_unit || 'kg'

  // One entry per folded name, displayed with the most recently used spelling,
  // so "Bench press" and "Bench Press" collapse into a single exercise.
  const exercises = useMemo(() => {
    const map = new Map()
    const consider = (name, at) => {
      const key = exerciseKey(name)
      if (!key) return
      const prev = map.get(key)
      if (!prev) map.set(key, { key, name: (name || '').trim(), lastAt: at })
      else if (at && (!prev.lastAt || at > prev.lastAt)) { prev.name = name.trim(); prev.lastAt = at }
    }
    allSets.forEach(s => {
      consider(s.exercise_name, s.completed_at)
      if (s.superset_partner_name) consider(s.superset_partner_name, s.completed_at)
    })
    // Planned but never logged — selectable, just with no data behind them
    planExercises.forEach(p => consider(p.exercise_name, null))
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [allSets, planExercises])

  const [selected, setSelected] = useState('')   // exercise_key
  const [renameOpen, setRenameOpen]   = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState('')
  const [renaming, setRenaming]       = useState(false)

  const selectedName = exercises.find(e => e.key === selected)?.name || ''

  // Raw sets for selected exercise, sorted oldest first
  const rawSets = useMemo(() => {
    if (!selected) return []
    const primary = allSets
      .filter(s => exerciseKey(s.exercise_name) === selected)
      .map(s => ({ ...s, _metric: s.metric || 'reps', _dur: s.duration_seconds }))
    const partner = allSets
      .filter(s => exerciseKey(s.superset_partner_name) === selected)
      .map(s => ({
        ...s, weight: s.partner_weight, reps: s.partner_reps,
        _metric: s.partner_metric || 'reps', _dur: s.partner_duration_seconds,
      }))
    return [...primary, ...partner]
      .filter(s => s.weight != null || s.reps != null || s._dur != null)
      .sort((a,b) => new Date(a.completed_at) - new Date(b.completed_at))
  }, [selected, allSets])

  const isTime   = rawSets.length > 0 && rawSets.every(s => s._metric === 'time')
  const repSets  = useMemo(() => rawSets.filter(s => s.weight != null && s.reps != null), [rawSets])
  const timeSets = useMemo(() => rawSets.filter(s => s._dur != null), [rawSets])

  // Most recent sessions first — answers "what weight did I use last time?"
  const recentSessions = useMemo(() => {
    const map = new Map()
    for (let i = rawSets.length - 1; i >= 0; i--) {
      const s = rawSets[i]
      const date = format(parseISO(s.completed_at), 'EEE, MMM d yyyy')
      if (!map.has(date)) map.set(date, [])
      map.get(date).push(s)
    }
    return [...map.entries()].slice(0, 5).map(([date, sets]) => ({
      date,
      sets: [...sets].sort((a, b) => (a.set_number || 0) - (b.set_number || 0)),
    }))
  }, [rawSets])

  const durationProgression = useMemo(() => {
    return timeSets.reduce((acc, s) => {
      const date = format(parseISO(s.completed_at), 'MMM d')
      const secs = +s._dur
      const last = acc[acc.length - 1]
      if (last?.date === date) {
        last.Seconds = Math.max(last.Seconds, secs)
        last.Total  += secs
      } else {
        acc.push({ date, Seconds: secs, Total: secs })
      }
      return acc
    }, [])
  }, [timeSets])

  // The three updates below are not a transaction, so refetch afterwards rather
  // than assuming they all landed.
  const doRename = async () => {
    const newName = renameDraft.trim()
    if (!newName || !selected) return
    setRenaming(true)
    setRenameError('')
    const results = await Promise.all([
      supabase.from('session_sets').update({ exercise_name: newName }).eq('exercise_key', selected),
      supabase.from('session_sets').update({ superset_partner_name: newName }).eq('partner_key', selected),
      supabase.from('day_exercises').update({ exercise_name: newName }).eq('exercise_key', selected),
    ])
    setRenaming(false)
    const failed = results.find(r => r.error)
    if (failed) { setRenameError(failed.error.message || 'Rename failed'); return }
    setSelected(exerciseKey(newName))
    setRenameOpen(false)
    onRenamed()
  }

  // Best weight + reps per session date (for weight/reps/1RM charts)
  const progression = useMemo(() => {
    return repSets.reduce((acc, s) => {
      const date = format(parseISO(s.completed_at), 'MMM d')
      const last = acc[acc.length - 1]
      const oneRM = +(+s.weight * (1 + +s.reps / 30)).toFixed(1)
      if (last?.date === date) {
        if (+s.weight > last.Weight) {
          last.Weight = +s.weight
          last.Reps   = +s.reps
          last.OneRM  = oneRM
        }
      } else {
        acc.push({ date, Weight: +s.weight, Reps: +s.reps, OneRM: oneRM })
      }
      return acc
    }, [])
  }, [repSets])

  // Volume per session date (sum of weight × reps)
  const volumeProgression = useMemo(() => {
    return repSets.reduce((acc, s) => {
      const date = format(parseISO(s.completed_at), 'MMM d')
      const vol = +(+s.weight * +s.reps).toFixed(0)
      const last = acc[acc.length - 1]
      if (last?.date === date) {
        last.Volume = +(last.Volume + vol).toFixed(0)
      } else {
        acc.push({ date, Volume: vol })
      }
      return acc
    }, [])
  }, [repSets])

  // Personal records
  const prs = useMemo(() => {
    if (!repSets.length) return null
    let maxWeight = 0, maxReps = 0, maxOneRM = 0, maxVolDate = '', maxVol = 0
    repSets.forEach(s => {
      const w = +s.weight, r = +s.reps
      if (w > maxWeight) maxWeight = w
      if (r > maxReps) maxReps = r
      const orm = +(w * (1 + r / 30)).toFixed(1)
      if (orm > maxOneRM) maxOneRM = orm
    })
    volumeProgression.forEach(v => {
      if (v.Volume > maxVol) { maxVol = v.Volume; maxVolDate = v.date }
    })
    return { maxWeight, maxReps, maxOneRM, maxVol, maxVolDate }
  }, [repSets, volumeProgression])

  const timePrs = useMemo(() => {
    if (!timeSets.length) return null
    const longest = timeSets.reduce((m, s) => Math.max(m, +s._dur), 0)
    const total   = timeSets.reduce((a, s) => a + +s._dur, 0)
    const best    = durationProgression.reduce((m, d) => Math.max(m, d.Total), 0)
    return { longest, total, best }
  }, [timeSets, durationProgression])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[#777] text-sm font-medium">Select Exercise</p>
          {selected && (
            <button
              onClick={() => { setRenameDraft(selectedName); setRenameError(''); setRenameOpen(true) }}
              className="text-accent text-xs font-medium"
            >
              Rename
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full h-12 px-4 pr-10 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
              focus:outline-none focus:border-accent/50 appearance-none"
          >
            <option value="">-- Choose an exercise --</option>
            {exercises.map(e => <option key={e.key} value={e.key}>{e.name}</option>)}
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none">▾</span>
        </div>
      </div>

      {selected && rawSets.length === 0 && (
        <EmptyState icon="📈" title="Nothing logged yet" subtitle="Track this exercise to see its history" />
      )}

      {/* Recent sessions — what to load today */}
      {recentSessions.length > 0 && (
        <Card>
          <p className="text-white font-semibold mb-1">Recent sessions</p>
          <p className="text-[#555] text-xs mb-3">Most recent first</p>
          <div className="flex flex-col gap-3">
            {recentSessions.map((sess, i) => (
              <div key={sess.date} className={`rounded-2xl px-3 py-2.5 ${i === 0 ? 'bg-accent/10 border border-accent/20' : 'bg-[#1e1e1e]'}`}>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p className={`text-xs font-semibold ${i === 0 ? 'text-accent' : 'text-[#777]'}`}>
                    {i === 0 ? 'Last session' : sess.date}
                  </p>
                  {i === 0 && <p className="text-[#777] text-xs">{sess.date}</p>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {sess.sets.map((s, si) => (
                    <span key={si} className="text-sm">
                      <span className="text-[#555] text-xs mr-1">{si + 1}</span>
                      <span className="text-white font-medium">
                        {s.weight != null ? `${s.weight}${unit}` : 'BW'}
                        {' × '}
                        {s._metric === 'time' ? formatDuration(s._dur) : (s.reps ?? '—')}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isTime && timePrs && (
        <Card>
          <p className="text-white font-semibold mb-3">Personal Records</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-accent text-2xl font-bold">{formatDuration(timePrs.longest)}</p>
              <p className="text-[#555] text-xs mt-1">Longest hold</p>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-[#4fdf7c] text-2xl font-bold">{formatDuration(timePrs.best)}</p>
              <p className="text-[#555] text-xs mt-1">Best session total</p>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-[#4fa8ff] text-2xl font-bold">{formatDuration(timePrs.total)}</p>
              <p className="text-[#555] text-xs mt-1">Total time under load</p>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-white text-2xl font-bold">{timeSets.length}</p>
              <p className="text-[#555] text-xs mt-1">Sets logged</p>
            </div>
          </div>
        </Card>
      )}

      {isTime && durationProgression.length > 1 && (
        <Card>
          <p className="text-white font-semibold mb-1">Hold Duration</p>
          <p className="text-[#555] text-xs mb-4">Longest set per session, in seconds</p>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={durationProgression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Seconds" stroke={getAccent()} strokeWidth={2.5}
                dot={{ fill: getAccent(), strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename exercise">
        <div className="flex flex-col gap-4">
          <p className="text-[#777] text-sm">
            Renames every logged set and plan entry for <span className="text-white font-medium">{selectedName}</span>.
            Use it to fold a misspelling back into the right exercise.
          </p>
          <input
            value={renameDraft}
            onChange={e => setRenameDraft(e.target.value)}
            autoFocus
            className="h-12 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
              focus:outline-none focus:border-accent/50 w-full"
          />
          {renameError && <p className="text-[#ff4f4f] text-sm">{renameError}</p>}
          <Button size="lg" className="w-full" onClick={doRename}
            disabled={renaming || !renameDraft.trim() || renameDraft.trim() === selectedName}>
            {renaming ? 'Renaming…' : 'Rename'}
          </Button>
        </div>
      </Modal>

      {!isTime && progression.length > 0 && prs && (
        <Card>
          <p className="text-white font-semibold mb-3">Personal Records</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-accent text-2xl font-bold">{prs.maxOneRM}</p>
              <p className="text-[#555] text-xs mt-1">Est. 1RM ({unit})</p>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-accent text-2xl font-bold">{prs.maxWeight}</p>
              <p className="text-[#555] text-xs mt-1">Max Weight ({unit})</p>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-[#4fa8ff] text-2xl font-bold">{prs.maxReps}</p>
              <p className="text-[#555] text-xs mt-1">Max Reps</p>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
              <p className="text-[#4fdf7c] text-2xl font-bold">{prs.maxVol.toLocaleString()}</p>
              <p className="text-[#555] text-xs mt-1">Best Volume</p>
              {prs.maxVolDate && <p className="text-[#333] text-xs">{prs.maxVolDate}</p>}
            </div>
          </div>
        </Card>
      )}

      {!isTime && progression.length > 1 && (
        <>
          <Card>
            <p className="text-white font-semibold mb-1">Estimated 1RM</p>
            <p className="text-[#555] text-xs mb-4">Epley formula: weight × (1 + reps/30)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={progression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="OneRM" name={`1RM (${unit})`} stroke={getAccent()} strokeWidth={2.5}
                  dot={{ fill: getAccent(), strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <p className="text-white font-semibold mb-4">Weight Progression</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={progression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Weight" name={`Weight (${unit})`} stroke="#4fa8ff" strokeWidth={2.5}
                  dot={{ fill: '#4fa8ff', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <p className="text-white font-semibold mb-4">Reps Progression</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={progression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Reps" stroke="#4fdf7c" strokeWidth={2.5}
                  dot={{ fill: '#4fdf7c', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {volumeProgression.length > 1 && (
            <Card>
              <p className="text-white font-semibold mb-1">Volume Load per Session</p>
              <p className="text-[#555] text-xs mb-4">Total weight × reps</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={volumeProgression} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Volume" name={`Volume (${unit})`} fill="#ff9f47" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
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
      <div className="flex gap-2">
        {['run','hiit','cycle','walk'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`px-4 h-9 rounded-full text-sm font-medium transition-all capitalize ${
              type === t ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
            }`}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🏃" title={`No ${type} sessions`} subtitle="Log some cardio to see analytics" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="text-center py-4">
              <p className="text-accent text-2xl font-bold">{filtered.length}</p>
              <p className="text-[#555] text-xs mt-1">Sessions</p>
            </Card>
            {totalDist > 0 && (
              <Card className="text-center py-4">
                <p className="text-accent text-2xl font-bold">{totalDist.toFixed(1)}</p>
                <p className="text-[#555] text-xs mt-1">Total km</p>
              </Card>
            )}
            {totalTime > 0 && (
              <Card className="text-center py-4">
                <p className="text-accent text-2xl font-bold">{Math.round(totalTime/60)}</p>
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
                  <Line type="monotone" dataKey="Distance" name="Distance (km)" stroke={getAccent()} strokeWidth={2.5}
                    dot={{ fill: getAccent(), strokeWidth: 0, r: 4 }} connectNulls />
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
                    <p className="text-accent text-xl font-bold">{Math.max(...hiitData.map(h => h.speed_high || 0))}</p>
                    <p className="text-[#555] text-xs mt-1">Best High Speed</p>
                  </div>
                  <div className="bg-[#1e1e1e] rounded-2xl p-3 text-center">
                    <p className="text-accent text-xl font-bold">{hiitData.reduce((a,h) => a + (h.reps || 0), 0)}</p>
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
  const [error, setError]     = useState('')

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
      weight: last?.weight ?? null,
      reps: last?.reps ?? null,
      metric: last?.metric || 'reps',
      duration_seconds: last?.duration_seconds ?? null,
      // Carry the pairing, or an added set silently degrades to a single
      superset_partner_name: last?.superset_partner_name || null,
      partner_weight: last?.partner_weight ?? null,
      partner_reps: last?.partner_reps ?? null,
      partner_metric: last?.partner_metric || 'reps',
      partner_duration_seconds: last?.partner_duration_seconds ?? null,
    }])
  }

  const save = async () => {
    setSaving(true)
    setError('')
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

    const rows = sets
      .filter(s => hasValue(s.weight) || hasValue(s.reps) || hasValue(s.duration_seconds))
      .map((s) => ({
        session_id: session.id,
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        weight: numOrNull(s.weight),
        metric: s.metric || 'reps',
        reps: numOrNull(s.reps),
        duration_seconds: numOrNull(s.duration_seconds),
        superset_partner_name: s.superset_partner_name || null,
        partner_weight: numOrNull(s.partner_weight),
        partner_metric: s.partner_metric || 'reps',
        partner_reps: numOrNull(s.partner_reps),
        partner_duration_seconds: numOrNull(s.partner_duration_seconds),
      }))

    // Write the replacements before clearing the originals: a failed insert
    // then leaves the workout intact instead of wiping it.
    const originalIds = sets.map(s => s.id).filter(id => !String(id).startsWith('new-'))
    if (rows.length) {
      const { error: insErr } = await supabase.from('session_sets').insert(rows)
      if (insErr) {
        setSaving(false)
        setError(insErr.message || 'Could not save sets — nothing was changed.')
        return
      }
    }
    if (originalIds.length) await supabase.from('session_sets').delete().in('id', originalIds)

    setSaving(false)
    onSaved({ ...session, started_at: newStart.toISOString(), ended_at: newEnd?.toISOString() || null, duration_seconds: duration, notes })
    onClose()
  }

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
                focus:outline-none focus:border-accent/50 w-full" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[#777] text-sm font-medium">End</label>
            <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-12 px-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
                focus:outline-none focus:border-accent/50 w-full" />
          </div>
        </div>

        {Object.entries(byExercise).map(([name, exSets]) => {
          const partnerName = exSets.find(s => s.superset_partner_name)?.superset_partner_name
          return (
            <div key={name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <p className="text-white font-semibold text-sm">{name}</p>
                  {partnerName && <>
                    <span className="text-accent text-xs bg-accent/10 px-2 h-5 rounded-full flex items-center font-bold shrink-0">SS</span>
                    <p className="text-white font-semibold text-sm">{partnerName}</p>
                  </>}
                </div>
                <button onClick={() => addSet(name)}
                  className="text-accent text-xs font-medium shrink-0">+ set</button>
              </div>
              <div className="flex items-center gap-2 px-1">
                <span className="w-5 text-[#555] text-xs">#</span>
                <span className="flex-1 text-center text-[#555] text-xs">{partnerName ? 'A weight' : 'Weight'}</span>
                <span className="flex-1 text-center text-[#555] text-xs">{partnerName ? 'A reps' : 'Reps'}</span>
                {partnerName && <>
                  <span className="flex-1 text-center text-[#555] text-xs">B weight</span>
                  <span className="flex-1 text-center text-[#555] text-xs">B reps</span>
                </>}
                <span className="w-7" />
              </div>
              {exSets.map((s, i) => {
                const gi = sets.indexOf(s)
                // Time-based sets edit duration_seconds; everything else edits reps
                const valField    = s.metric === 'time' ? 'duration_seconds' : 'reps'
                const pValField   = s.partner_metric === 'time' ? 'partner_duration_seconds' : 'partner_reps'
                const cls = 'flex-1 min-w-0 h-10 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-center text-sm focus:outline-none focus:border-accent/50'
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-5 text-[#555] text-xs text-center">{i + 1}</span>
                    <input type="number" inputMode="decimal" value={s.weight ?? ''} placeholder="0"
                      onChange={e => updateSet(gi, 'weight', e.target.value)} className={cls} />
                    <input type="number" inputMode="numeric" value={s[valField] ?? ''}
                      placeholder={s.metric === 'time' ? 'sec' : '0'}
                      onChange={e => updateSet(gi, valField, e.target.value)} className={cls} />
                    {partnerName && <>
                      <input type="number" inputMode="decimal" value={s.partner_weight ?? ''} placeholder="0"
                        onChange={e => updateSet(gi, 'partner_weight', e.target.value)} className={cls} />
                      <input type="number" inputMode="numeric" value={s[pValField] ?? ''}
                        placeholder={s.partner_metric === 'time' ? 'sec' : '0'}
                        onChange={e => updateSet(gi, pValField, e.target.value)} className={cls} />
                    </>}
                    <button onClick={() => removeSet(gi)}
                      className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-[#ff4f4f] text-lg shrink-0">×</button>
                  </div>
                )
              })}
            </div>
          )
        })}

        <div className="flex flex-col gap-1.5">
          <label className="text-[#777] text-sm font-medium">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Any notes…"
            className="px-4 py-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
              placeholder:text-[#444] focus:outline-none focus:border-accent/50 resize-none w-full" />
        </div>

        {error && <p className="text-[#ff4f4f] text-sm">{error}</p>}
        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ sessions, onDelete, onEdit, onView }) {
  function formatDur(secs) {
    if (!secs) return null
    const m = Math.floor(secs / 60), s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  if (sessions.length === 0) {
    return <EmptyState icon="📋" title="No workout logs yet" subtitle="Finish a workout to see it here" />
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map(s => (
        <Card key={s.id} className="cursor-pointer active:opacity-80 transition-opacity" onClick={() => onView(s)}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1e1e1e] flex items-center justify-center text-xl shrink-0">💪</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{s.day_title || 'Workout'}</p>
                  <p className="text-[#555] text-xs">{s.plan_name || ''}</p>
                </div>
                <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onEdit(s)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[#777] hover:bg-accent/10 hover:text-accent transition-colors text-sm">✏️</button>
                  <button onClick={() => onDelete(s.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[#555] hover:bg-[#ff4f4f]/10 hover:text-[#ff4f4f] transition-colors text-lg leading-none">×</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <div>
                  <p className="text-[#555] text-xs">Date</p>
                  <p className="text-white text-sm font-medium">{format(parseISO(s.started_at), 'EEE, MMM d yyyy')}</p>
                </div>
                <div>
                  <p className="text-[#555] text-xs">Start</p>
                  <p className="text-white text-sm font-medium">{format(parseISO(s.started_at), 'h:mm a')}</p>
                </div>
                {s.ended_at && (
                  <div>
                    <p className="text-[#555] text-xs">End</p>
                    <p className="text-white text-sm font-medium">{format(parseISO(s.ended_at), 'h:mm a')}</p>
                  </div>
                )}
                {s.duration_seconds && (
                  <div>
                    <p className="text-[#555] text-xs">Duration</p>
                    <p className="text-accent text-sm font-semibold">{formatDur(s.duration_seconds)}</p>
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
  const [planExercises, setPlanExercises] = useState([])
  const [cardio,    setCardio]    = useState([])
  const [stepsHistory, setStepsHistory] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [filterMuscle, setFilterMuscle] = useState(null)
  const [viewSession, setViewSession]   = useState(null)
  const [editSession, setEditSession]   = useState(null)

  const MUSCLE_GROUPS = ['Chest','Back','Shoulders','Biceps','Triceps','Legs','Glutes','Core']

  const load = useCallback(() => {
    if (!user) return
    Promise.all([
      supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(200),
      // Newest first: the limit truncates old history rather than hiding
      // recently logged exercises from the Exercises tab.
      supabase.from('session_sets').select('*, workout_sessions!inner(user_id)').eq('workout_sessions.user_id', user.id).order('completed_at', { ascending: false }).limit(5000),
      supabase.from('cardio_sessions').select('*, hiit_sets(*)').eq('user_id', user.id).order('date', { ascending: false }).limit(200),
      // Planned exercises, so ones never logged yet are still selectable.
      // RLS scopes day_exercises to the user via plan ownership.
      supabase.from('day_exercises').select('exercise_name, metric').limit(1000),
    ]).then(([{ data: s }, { data: sets }, { data: c }, { data: planEx }]) => {
      setSessions(s || [])
      setAllSets(sets || [])
      setCardio(c || [])
      setPlanExercises(planEx || [])
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    load()

    if (Capacitor.isNativePlatform()) {
      hasPermissions().then(granted => {
        if (granted) readStepsHistory(30).then(h => setStepsHistory(h || {}))
      })
    }
  }, [load])

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
              tab === i ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
            }`}>{t}</button>
        ))}
      </div>

      <div className="px-4">
        {tab === 0 && <OverviewTab sessions={sessions} cardioSessions={cardio} stepsHistory={stepsHistory} />}
        {tab === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterMuscle(null)}
                className={`px-3 h-8 rounded-full text-xs font-medium transition-all ${
                  !filterMuscle ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
                }`}>All</button>
              {MUSCLE_GROUPS.map(g => (
                <MuscleChip key={g} group={g} active={filterMuscle === g} onClick={() => setFilterMuscle(filterMuscle === g ? null : g)} />
              ))}
            </div>
            <Card>
              <CalendarHeatmap sessions={sessions} cardioSessions={cardio} filterMuscle={filterMuscle} onSessionClick={setViewSession} />
            </Card>
          </div>
        )}
        {tab === 2 && <ExercisesTab allSets={allSets} planExercises={planExercises} onRenamed={load} />}
        {tab === 3 && <CardioTab cardioSessions={cardio} />}
        {tab === 4 && <HistoryTab sessions={sessions} onDelete={deleteSession} onEdit={setEditSession} onView={setViewSession} />}
      </div>

      <SessionDetailModal
        session={viewSession} open={!!viewSession}
        onClose={() => setViewSession(null)}
        onEdit={s => { setViewSession(null); setEditSession(s) }}
      />
      <EditSessionModal
        session={editSession} open={!!editSession}
        onClose={() => setEditSession(null)}
        onSaved={updated => setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))}
      />
    </div>
  )
}
