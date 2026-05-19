import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { format, parseISO } from 'date-fns'

// ─── beep via Web Audio ────────────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.25, 0.5].forEach(delay => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.5, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3)
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.3)
    })
  } catch (_) {}
}

// ─── Rest Timer ring (display only — state lives in TrackPage) ─────────────────
function RestTimerRing({ remaining, total, running, onAddTime, onToggle, onSkip }) {
  const pct  = total > 0 ? ((total - remaining) / total) * 100 : 100
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#1e1e1e" strokeWidth="8" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="#e8ff47" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-3xl font-bold tabular-nums">
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={onAddTime}>+15s</Button>
        <Button variant="secondary" size="sm" onClick={onToggle}>{running ? 'Pause' : 'Resume'}</Button>
        <Button variant="danger"    size="sm" onClick={onSkip}>Skip</Button>
      </div>
    </div>
  )
}

// ─── Exercise History Modal ───────────────────────────────────────────────────
function ExerciseHistoryModal({ name, unit, open, onClose }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !name) return
    setLoading(true)
    Promise.all([
      supabase.from('session_sets')
        .select('set_number, weight, reps, partner_weight, partner_reps, completed_at, superset_partner_name, workout_sessions(started_at, day_title)')
        .eq('exercise_name', name)
        .order('completed_at', { ascending: false })
        .limit(60),
      supabase.from('session_sets')
        .select('set_number, weight, reps, partner_weight, partner_reps, completed_at, superset_partner_name, workout_sessions(started_at, day_title)')
        .eq('superset_partner_name', name)
        .order('completed_at', { ascending: false })
        .limit(60),
    ]).then(([{ data: primary }, { data: partner }]) => {
      const p1 = (primary || []).map(s => ({ ...s, _w: s.weight, _r: s.reps }))
      const p2 = (partner || []).map(s => ({ ...s, _w: s.partner_weight, _r: s.partner_reps }))
      const combined = [...p1, ...p2]
        .filter(s => s._w || s._r)
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
      setRows(combined)
      setLoading(false)
    })
  }, [open, name])

  const byDate = rows.reduce((acc, s) => {
    const key = format(parseISO(s.workout_sessions?.started_at || s.completed_at), 'EEE, MMM d')
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const maxWeight = rows.reduce((m, s) => s._w ? Math.max(m, +s._w) : m, 0)
  const sessions  = Object.keys(byDate).length

  return (
    <Modal open={open} onClose={onClose} title={name}>
      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="text-[#555] text-sm text-center py-6">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-6">No history yet for this exercise</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {maxWeight > 0 && (
                <div className="bg-[#1a1a1a] rounded-2xl p-3 text-center">
                  <p className="text-[#e8ff47] text-2xl font-bold">{maxWeight}</p>
                  <p className="text-[#555] text-xs mt-0.5">{unit} best</p>
                </div>
              )}
              <div className="bg-[#1a1a1a] rounded-2xl p-3 text-center">
                <p className="text-white text-2xl font-bold">{sessions}</p>
                <p className="text-[#555] text-xs mt-0.5">sessions</p>
              </div>
            </div>

            {Object.entries(byDate).slice(0, 8).map(([date, sets]) => (
              <div key={date} className="flex flex-col gap-1">
                <p className="text-[#555] text-xs font-medium uppercase tracking-wide">{date}</p>
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#161616] rounded-xl px-3 h-10">
                    <span className="text-[#444] text-xs w-5 text-center">{s.set_number}</span>
                    <span className="text-white text-sm font-semibold flex-1">{s._w ?? '—'}<span className="text-[#444] font-normal text-xs ml-0.5">{unit}</span></span>
                    <span className="text-[#555] text-xs">×</span>
                    <span className="text-white text-sm font-semibold flex-1 text-right">{s._r ?? '—'}<span className="text-[#444] font-normal text-xs ml-0.5">reps</span></span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Set Entry Row ─────────────────────────────────────────────────────────────
function SetRow({ setNum, weight, reps, onChange, onRemove, onToggleLock, locked, unit }) {
  if (locked) {
    return (
      <div className="flex items-center gap-2.5 bg-[#161616] border border-[#4fdf7c]/10 rounded-2xl px-3 h-14">
        <div className="w-7 h-7 rounded-full bg-[#4fdf7c]/15 flex items-center justify-center shrink-0">
          <span className="text-[#4fdf7c] text-xs font-bold leading-none">✓</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-1">
          <span className="text-white text-lg font-semibold">{weight || '—'}</span>
          <span className="text-[#444] text-xs">{unit}</span>
        </div>
        <div className="w-px h-5 bg-[#222] shrink-0" />
        <div className="flex-1 flex items-center justify-center gap-1">
          <span className="text-white text-lg font-semibold">{reps || '—'}</span>
          <span className="text-[#444] text-xs">reps</span>
        </div>
        <button onClick={onToggleLock}
          className="w-8 h-8 flex items-center justify-center text-[#383838] hover:text-[#666] transition-colors shrink-0 text-sm">
          ✏️
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5 bg-[#161616] rounded-2xl px-3 h-14">
      <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center shrink-0">
        <span className="text-[#555] text-xs font-bold leading-none">{setNum}</span>
      </div>
      <input
        type="number" value={weight} onChange={e => onChange('weight', e.target.value)}
        placeholder="0" inputMode="decimal"
        className="flex-1 min-w-0 h-10 bg-transparent text-white text-center text-lg font-semibold focus:outline-none placeholder:text-[#333]"
      />
      <span className="text-[#333] text-xs shrink-0">{unit}</span>
      <div className="w-px h-5 bg-[#222] shrink-0" />
      <input
        type="number" value={reps} onChange={e => onChange('reps', e.target.value)}
        placeholder="0" inputMode="numeric"
        className="flex-1 min-w-0 h-10 bg-transparent text-white text-center text-lg font-semibold focus:outline-none placeholder:text-[#333]"
      />
      <button onClick={onToggleLock}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#4fdf7c]/10 text-[#4fdf7c] hover:bg-[#4fdf7c]/20 transition-colors shrink-0">
        ✓
      </button>
      <button onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center text-[#2e2e2e] hover:text-[#ff4f4f] text-xl shrink-0 transition-colors">×</button>
    </div>
  )
}

// ─── Superset Entry ────────────────────────────────────────────────────────────
function SupersetEntry({ pair, sets, onSetsChange, unit, prevSets, onNameClick }) {
  const [A, B] = pair

  const addSet = () => {
    const last = sets[sets.length - 1]
    onSetsChange([...sets, {
      id: crypto.randomUUID(),
      weightA: last?.weightA || '', repsA: last?.repsA || '',
      weightB: last?.weightB || '', repsB: last?.repsB || '',
      locked: false,
    }])
  }

  const updateSet  = (i, field, val) => onSetsChange(sets.map((s, si) => si === i ? { ...s, [field]: val } : s))
  const removeSet  = (i) => onSetsChange(sets.filter((_, si) => si !== i))
  const toggleLock = (i) => onSetsChange(sets.map((s, si) => si === i ? { ...s, locked: !s.locked } : s))

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[#e8ff47] text-xs font-bold">A</span>
            <button onClick={() => onNameClick(A.exercise_name)} className="text-white text-sm font-medium hover:text-[#e8ff47] transition-colors text-left">{A.exercise_name}</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#e8ff47] text-xs font-bold">B</span>
            <button onClick={() => onNameClick(B.exercise_name)} className="text-white text-sm font-medium hover:text-[#e8ff47] transition-colors text-left">{B.exercise_name}</button>
          </div>
        </div>
        <span className="text-[#e8ff47] text-xs font-bold bg-[#e8ff47]/10 px-2 h-5 rounded-full flex items-center">Superset</span>
      </div>

      {/* Previous superset */}
      {prevSets?.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-2xl px-3 py-2 flex flex-col gap-1">
          <span className="text-[#555] text-xs font-medium">Previous:</span>
          {prevSets.map((p, i) => (
            <span key={i} className="text-[#777] text-xs">
              Set {p.set_number}: <span className="text-[#aaa] font-medium">{p.weight}{unit} × {p.reps}</span>
              {p.partner_weight != null && <span className="text-[#666]"> / {p.partner_weight}{unit} × {p.partner_reps}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center gap-2 px-1">
        <span className="w-6" />
        <span className="flex-1 text-center text-[#555] text-xs">Weight</span>
        <span className="w-5" />
        <span className="flex-1 text-center text-[#555] text-xs">Reps</span>
        <span className="w-8" /><span className="w-8" />
      </div>

      {/* A sets */}
      <div className="bg-[#e8ff47]/5 rounded-2xl p-2 flex flex-col gap-1.5">
        <p className="text-[#e8ff47] text-xs font-bold px-1">A — {A.exercise_name}</p>
        {sets.map((s, i) => (
          <SetRow key={s.id} setNum={i + 1} weight={s.weightA} reps={s.repsA} unit={unit}
            locked={s.locked}
            onChange={(f, v) => updateSet(i, f === 'weight' ? 'weightA' : 'repsA', v)}
            onRemove={() => removeSet(i)}
            onToggleLock={() => toggleLock(i)} />
        ))}
      </div>

      {/* B sets */}
      <div className="bg-[#e8ff47]/5 rounded-2xl p-2 flex flex-col gap-1.5">
        <p className="text-[#e8ff47] text-xs font-bold px-1">B — {B.exercise_name}</p>
        {sets.map((s, i) => (
          <SetRow key={s.id + 'b'} setNum={i + 1} weight={s.weightB} reps={s.repsB} unit={unit}
            locked={s.locked}
            onChange={(f, v) => updateSet(i, f === 'weight' ? 'weightB' : 'repsB', v)}
            onRemove={() => removeSet(i)}
            onToggleLock={() => toggleLock(i)} />
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={addSet}>+ Add Set</Button>
    </div>
  )
}

// ─── Single Exercise Entry ─────────────────────────────────────────────────────
function ExerciseEntry({ exercise, sets, onSetsChange, unit, prevSets, onNameClick }) {
  const addSet = () => {
    const last = sets[sets.length - 1]
    onSetsChange([...sets, { id: crypto.randomUUID(), weight: last?.weight || '', reps: last?.reps || '', locked: false }])
  }
  const updateSet    = (i, field, val) => onSetsChange(sets.map((s, si) => si === i ? { ...s, [field]: val } : s))
  const removeSet    = (i) => onSetsChange(sets.filter((_, si) => si !== i))
  const toggleLock   = (i) => onSetsChange(sets.map((s, si) => si === i ? { ...s, locked: !s.locked } : s))

  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => onNameClick(exercise.exercise_name)} className="text-white font-bold text-base text-left hover:text-[#e8ff47] transition-colors">
        {exercise.exercise_name}
      </button>
      {exercise.muscle_group && <p className="text-[#444] text-xs -mt-1">{exercise.muscle_group}</p>}

      {/* Previous workout row */}
      {prevSets?.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-2xl px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-[#555] text-xs font-medium w-full">Previous:</span>
          {prevSets.map((p, i) => (
            <span key={i} className="text-[#777] text-xs">
              Set {p.set_number}: <span className="text-[#aaa] font-medium">{p.weight}{unit} × {p.reps}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5 px-3 mt-1">
        <span className="w-7" />
        <span className="flex-1 text-center text-[#383838] text-xs">Weight</span>
        <span className="w-4" />
        <span className="flex-1 text-center text-[#383838] text-xs">Reps</span>
        <span className="w-16" />
      </div>

      {sets.map((s, i) => (
        <SetRow key={s.id} setNum={i + 1} weight={s.weight} reps={s.reps} unit={unit}
          locked={s.locked}
          onChange={(f, v) => updateSet(i, f, v)}
          onRemove={() => removeSet(i)}
          onToggleLock={() => toggleLock(i)} />
      ))}

      <Button variant="secondary" size="sm" onClick={addSet}>+ Add Set</Button>
    </div>
  )
}

// ─── Main Track Page ───────────────────────────────────────────────────────────
export default function TrackPage() {
  const { user }      = useAuth()
  const { settings }  = useSettings()
  const navigate      = useNavigate()
  const unit          = settings.weight_unit || 'kg'

  const [phase, setPhase]         = useState('select')  // select | active | done
  const [plan, setPlan]           = useState(null)
  const [days, setDays]           = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [exercises, setExercises] = useState([])  // day_exercises rows

  // Tracking state
  const [session, setSession]     = useState(null)  // db session row
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed]     = useState(0)
  const startTimeRef = useRef(null)
  const [sets, setSets]           = useState({})    // exerciseId/supersetGroup => sets[]
  const [prevSetsMap, setPrevSetsMap] = useState({}) // exercise_name => session_sets[]
  const [activeExIdx, setActiveExIdx] = useState(0)
  const [showTimer, setShowTimer]     = useState(false)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restTotal, setRestTotal]     = useState(0)
  const [restRunning, setRestRunning] = useState(false)
  const restEndRef = useRef(null)
  const restIntervalRef = useRef(null)

  const [loading, setLoading]     = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [showAddEx, setShowAddEx]   = useState(false)
  const [customExName, setCustomExName] = useState('')
  const [exHistory, setExHistory]   = useState(null)  // exercise name string

  const elapsedRef = useRef()

  useEffect(() => { loadActivePlan() }, [user])

  // Persist active workout to localStorage
  useEffect(() => {
    if (phase === 'active' && session) {
      localStorage.setItem('lift_workout', JSON.stringify({
        phase, sessionId: session.id, startTimeMs: startTimeRef.current,
        selectedDay, exercises, sets, activeExIdx,
      }))
    } else if (phase === 'done' || phase === 'select') {
      localStorage.removeItem('lift_workout')
    }
  }, [phase, sets, activeExIdx])

  useEffect(() => {
    if (phase !== 'active') return
    const tick = () => {
      if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }
    elapsedRef.current = setInterval(tick, 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(elapsedRef.current); document.removeEventListener('visibilitychange', onVisible) }
  }, [phase])

  useEffect(() => {
    if (!restRunning) { clearInterval(restIntervalRef.current); return }
    restIntervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((restEndRef.current - Date.now()) / 1000))
      setRestRemaining(left)
      if (left === 0) { clearInterval(restIntervalRef.current); setRestRunning(false); playBeep() }
    }, 500)
    return () => clearInterval(restIntervalRef.current)
  }, [restRunning])

  const startRestTimer = () => {
    const dur = settings.rest_timer_seconds || 90
    restEndRef.current = Date.now() + dur * 1000
    setRestTotal(dur); setRestRemaining(dur); setRestRunning(true); setShowTimer(true)
  }
  const pauseResumeRest = () => {
    if (restRunning) {
      setRestRunning(false)
    } else {
      restEndRef.current = Date.now() + restRemaining * 1000
      setRestRunning(true)
    }
  }
  const addRestTime = () => {
    restEndRef.current += 15000
    setRestRemaining(r => r + 15)
    setRestTotal(t => t + 15)
  }
  const skipRest = () => { setRestRunning(false); setRestRemaining(0); setShowTimer(false) }

  async function loadActivePlan() {
    if (!user) return
    setLoading(true)

    // Restore interrupted workout from localStorage
    const saved = localStorage.getItem('lift_workout')
    if (saved) {
      try {
        const w = JSON.parse(saved)
        startTimeRef.current = w.startTimeMs
        setStartTime(new Date(w.startTimeMs))
        setElapsed(Math.floor((Date.now() - w.startTimeMs) / 1000))
        setSelectedDay(w.selectedDay)
        setExercises(w.exercises)
        setSets(w.sets)
        setActiveExIdx(w.activeExIdx || 0)
        setSession({ id: w.sessionId })
        setPhase('active')
        setLoading(false)
        return
      } catch (_) { localStorage.removeItem('lift_workout') }
    }

    const { data: p } = await supabase.from('workout_plans').select('*').eq('user_id', user.id).eq('is_active', true).single()
    setPlan(p)
    if (p) {
      const { data: d } = await supabase.from('workout_days').select('*').eq('plan_id', p.id).order('day_number')
      setDays(d || [])
    }
    setLoading(false)
  }

  const selectDay = async (day) => {
    setSelectedDay(day)
    const { data: ex } = await supabase.from('day_exercises').select('*').eq('day_id', day.id).order('order_index')
    setExercises(ex || [])

    // Load previous session's sets for reference
    const { data: prevSess } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('day_id', day.id)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
    if (prevSess) {
      const { data: ps } = await supabase
        .from('session_sets')
        .select('*')
        .eq('session_id', prevSess.id)
        .order('set_number')
      const map = {}
      for (const row of ps || []) {
        if (!map[row.exercise_name]) map[row.exercise_name] = []
        map[row.exercise_name].push(row)
      }
      setPrevSetsMap(map)
    }
  }

  const startWorkout = async () => {
    const now = new Date()
    setStartTime(now)
    startTimeRef.current = now.getTime()
    setElapsed(0)
    // Create session in DB
    const { data: sess } = await supabase.from('workout_sessions').insert({
      user_id: user.id,
      plan_id: plan?.id,
      day_id: selectedDay?.id,
      plan_name: plan?.name,
      day_title: selectedDay?.title,
      muscle_groups: selectedDay?.muscle_groups || [],
      started_at: now.toISOString(),
    }).select().single()
    setSession(sess)

    // Init sets
    const initSets = {}
    const seen = new Set()
    for (const ex of exercises) {
      if (ex.is_superset) {
        if (!seen.has(ex.superset_group)) {
          seen.add(ex.superset_group)
          initSets[ex.superset_group] = [{ id: crypto.randomUUID(), weightA: '', repsA: '', weightB: '', repsB: '' }]
        }
      } else {
        initSets[ex.id] = [{ id: crypto.randomUUID(), weight: '', reps: '' }]
      }
    }
    setSets(initSets)
    setPhase('active')
  }

  const addCustomExercise = () => {
    const name = customExName.trim()
    if (!name) return
    const id = crypto.randomUUID()
    const newEx = { id, exercise_name: name, is_superset: false, order_index: exercises.length, muscle_group: null }
    setExercises(prev => [...prev, newEx])
    setSets(prev => ({ ...prev, [id]: [{ id: crypto.randomUUID(), weight: '', reps: '', locked: false }] }))
    setActiveExIdx(grouped.length)  // grouped.length is the current count, new ex goes there
    setCustomExName('')
    setShowAddEx(false)
  }

  const finishWorkout = async () => {
    setFinishing(true)
    const endTime = new Date()
    const duration = Math.round((endTime - startTime) / 1000)

    // Upsert session end
    if (session) {
      await supabase.from('workout_sessions').update({
        ended_at: endTime.toISOString(),
        duration_seconds: duration,
      }).eq('id', session.id)
    }

    // Save sets
    if (session) {
      const rows = []
      const seen = new Set()
      for (const ex of exercises) {
        if (ex.is_superset) {
          if (seen.has(ex.superset_group)) continue
          seen.add(ex.superset_group)
          const pair = exercises.filter(e => e.superset_group === ex.superset_group)
          const [A, B] = pair
          const ss = sets[ex.superset_group] || []
          ss.forEach((s, i) => {
            if (s.repsA || s.weightA) rows.push({
              session_id: session.id, exercise_name: A.exercise_name,
              set_number: i + 1, weight: parseFloat(s.weightA) || null,
              reps: parseInt(s.repsA) || null,
              superset_partner_name: B.exercise_name,
              partner_weight: parseFloat(s.weightB) || null,
              partner_reps: parseInt(s.repsB) || null,
            })
          })
        } else {
          const exSets = sets[ex.id] || []
          exSets.forEach((s, i) => {
            if (s.reps || s.weight) rows.push({
              session_id: session.id, exercise_name: ex.exercise_name,
              set_number: i + 1, weight: parseFloat(s.weight) || null,
              reps: parseInt(s.reps) || null,
            })
          })
        }
      }
      if (rows.length > 0) await supabase.from('session_sets').insert(rows)
    }

    localStorage.removeItem('lift_workout')
    setFinishing(false)
    setPhase('done')
  }

  const elapsed_str = () => {
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Build grouped exercise list for display
  const grouped = []
  const seen = new Set()
  for (const ex of exercises) {
    if (ex.is_superset) {
      if (!seen.has(ex.superset_group)) {
        seen.add(ex.superset_group)
        const pair = exercises.filter(e => e.superset_group === ex.superset_group)
        grouped.push({ type: 'superset', pair, key: ex.superset_group })
      }
    } else {
      grouped.push({ type: 'exercise', ex, key: ex.id })
    }
  }

  if (loading) return <PageLoader />

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80dvh] px-6 text-center gap-6">
        <div className="text-7xl">🎉</div>
        <div>
          <p className="text-white text-2xl font-bold">Workout Complete!</p>
          <p className="text-[#555] mt-1">{selectedDay?.title}</p>
        </div>
        <div className="bg-[#141414] border border-[#2e2e2e] rounded-3xl px-8 py-5 flex gap-8">
          <div className="text-center">
            <p className="text-[#e8ff47] text-2xl font-bold">{elapsed_str()}</p>
            <p className="text-[#555] text-xs mt-1">Duration</p>
          </div>
          <div className="text-center">
            <p className="text-[#e8ff47] text-2xl font-bold">
              {Object.values(sets).reduce((acc, arr) => acc + arr.length, 0)}
            </p>
            <p className="text-[#555] text-xs mt-1">Sets</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" className="w-full" onClick={() => navigate('/')}>Back to Home</Button>
          <Button size="md" variant="secondary" className="w-full" onClick={() => navigate('/analytics')}>View Analytics</Button>
        </div>
      </div>
    )
  }

  // ── Active workout ───────────────────────────────────────────────────────────
  if (phase === 'active') {
    const item = grouped[activeExIdx]
    return (
      <div className="flex flex-col min-h-dvh">
        {/* Top bar */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
          <div>
            <p className="text-[#e8ff47] font-bold text-lg tabular-nums">{elapsed_str()}</p>
            <p className="text-[#555] text-xs">{selectedDay?.title}</p>
          </div>
          <Button size="sm" variant="danger" onClick={finishWorkout} disabled={finishing}>
            {finishing ? 'Saving…' : 'Finish'}
          </Button>
        </div>

        {/* Exercise nav pills */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-[#1e1e1e] shrink-0">
          {grouped.map((item, i) => {
            const label = item.type === 'superset'
              ? `${item.pair[0].exercise_name.split(' ')[0]} SS`
              : item.ex.exercise_name.split(' ').slice(0,2).join(' ')
            return (
              <button key={item.key} onClick={() => setActiveExIdx(i)}
                className={`shrink-0 px-3 h-8 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  activeExIdx === i ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] text-[#777] border border-[#2e2e2e]'
                }`}>{label}</button>
            )
          })}
          <button onClick={() => setShowAddEx(true)}
            className="shrink-0 px-3 h-8 rounded-full text-xs font-medium border border-dashed border-[#444] text-[#555] whitespace-nowrap">
            + Add
          </button>
        </div>

        {/* Active exercise entry */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {item?.type === 'superset' ? (
            <SupersetEntry
              pair={item.pair}
              sets={sets[item.key] || []}
              onSetsChange={s => setSets(prev => ({ ...prev, [item.key]: s }))}
              unit={unit}
              prevSets={prevSetsMap[item.pair[0].exercise_name] || []}
              onNameClick={setExHistory}
            />
          ) : item?.type === 'exercise' ? (
            <ExerciseEntry
              exercise={item.ex}
              sets={sets[item.key] || []}
              onSetsChange={s => setSets(prev => ({ ...prev, [item.key]: s }))}
              unit={unit}
              prevSets={prevSetsMap[item.ex.exercise_name] || []}
              onNameClick={setExHistory}
            />
          ) : null}
        </div>

        {/* Persistent rest timer mini-bar */}
        {restRunning && !showTimer && (
          <button
            onClick={() => setShowTimer(true)}
            className="mx-4 mb-2 bg-[#e8ff47]/10 border border-[#e8ff47]/30 rounded-2xl px-4 py-2 flex items-center justify-between"
          >
            <span className="text-[#e8ff47] text-sm font-semibold">⏱ Rest</span>
            <span className="text-[#e8ff47] text-lg font-bold tabular-nums">
              {Math.floor(restRemaining/60)}:{(restRemaining%60).toString().padStart(2,'0')}
            </span>
            <span className="text-[#e8ff47]/50 text-xs">tap to expand</span>
          </button>
        )}

        {/* Bottom bar */}
        <div className="px-4 py-4 border-t border-[#1e1e1e] bg-[#0a0a0a] flex gap-3 shrink-0">
          <Button variant="secondary" size="md" className="flex-1" onClick={startRestTimer}>
            ⏱ Rest Timer
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" disabled={activeExIdx === 0}
              onClick={() => setActiveExIdx(i => i - 1)}>←</Button>
            <Button variant="ghost" size="icon" disabled={activeExIdx === grouped.length - 1}
              onClick={() => setActiveExIdx(i => i + 1)}>→</Button>
          </div>
        </div>

        {/* Add custom exercise sheet */}
        {showAddEx && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddEx(false)} />
            <div className="relative z-10 bg-[#141414] border-t border-[#2e2e2e] rounded-t-3xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">Add Exercise</p>
                <button onClick={() => setShowAddEx(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2e2e2e] text-[#777] text-xl">×</button>
              </div>
              <input
                type="text"
                value={customExName}
                onChange={e => setCustomExName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomExercise()}
                placeholder="Exercise name…"
                autoFocus
                className="h-12 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
                  placeholder:text-[#444] focus:outline-none focus:border-[#e8ff47]/50 w-full"
              />
              <Button size="lg" className="w-full" onClick={addCustomExercise} disabled={!customExName.trim()}>
                Add to Workout
              </Button>
            </div>
          </div>
        )}

        {/* Rest timer modal */}
        <Modal open={showTimer} onClose={() => setShowTimer(false)} title="Rest Timer">
          <RestTimerRing
            remaining={restRemaining} total={restTotal} running={restRunning}
            onAddTime={addRestTime} onToggle={pauseResumeRest} onSkip={skipRest}
          />
        </Modal>

        {/* Exercise history modal */}
        <ExerciseHistoryModal
          name={exHistory} unit={unit}
          open={!!exHistory} onClose={() => setExHistory(null)}
        />
      </div>
    )
  }

  // ── Select day ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <div>
        <h1 className="text-xl font-bold text-white">Track Workout</h1>
        {plan && <p className="text-[#555] text-sm mt-0.5">{plan.name}</p>}
      </div>

      {!plan ? (
        <div className="flex flex-col gap-4 items-center py-10 text-center">
          <div className="text-5xl opacity-30">📋</div>
          <p className="text-white font-semibold">No active plan</p>
          <p className="text-[#555] text-sm">Go to Plans and set one as active first</p>
          <Button onClick={() => navigate('/plans')}>Go to Plans</Button>
        </div>
      ) : (
        <>
          <p className="text-[#777] text-sm font-medium uppercase tracking-wider">Select today's day</p>
          <div className="flex flex-col gap-3">
            {days.map(day => (
              <button key={day.id} onClick={() => selectDay(day)}
                className={`text-left bg-[#141414] border rounded-3xl p-4 transition-all active:scale-[0.99] ${
                  selectedDay?.id === day.id ? 'border-[#e8ff47]/50 bg-[#e8ff47]/5' : 'border-[#2e2e2e] hover:border-[#3e3e3e]'
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#777] text-xs mb-0.5">Day {day.day_number}</p>
                    <p className="text-white font-bold text-lg">{day.title}</p>
                  </div>
                  {selectedDay?.id === day.id && <span className="text-[#e8ff47] text-xl">✓</span>}
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {day.muscle_groups?.map(g => <MuscleChip key={g} group={g} />)}
                </div>
              </button>
            ))}
          </div>

          {selectedDay && exercises.length > 0 && (
            <div className="bg-[#141414] border border-[#2e2e2e] rounded-3xl p-4 flex flex-col gap-2">
              <p className="text-[#777] text-xs font-medium uppercase tracking-wider">Today's exercises</p>
              {(() => {
                const gl = []; const sv = new Set()
                for (const ex of exercises) {
                  if (ex.is_superset) {
                    if (!sv.has(ex.superset_group)) {
                      sv.add(ex.superset_group)
                      const pair = exercises.filter(e => e.superset_group === ex.superset_group)
                      gl.push(
                        <div key={ex.superset_group} className="flex items-center gap-2">
                          <span className="text-[#e8ff47] text-xs font-bold bg-[#e8ff47]/10 px-1.5 h-5 rounded flex items-center">SS</span>
                          <span className="text-white text-sm">{pair.map(p => p.exercise_name).join(' + ')}</span>
                        </div>
                      )
                    }
                  } else {
                    gl.push(
                      <div key={ex.id} className="flex items-center gap-2">
                        <span className="text-[#555] text-sm">·</span>
                        <span className="text-white text-sm">{ex.exercise_name}</span>
                      </div>
                    )
                  }
                }
                return gl
              })()}
            </div>
          )}

          {selectedDay && (
            <Button size="xl" className="w-full" onClick={startWorkout}>
              Start Workout
            </Button>
          )}
        </>
      )}
    </div>
  )
}
