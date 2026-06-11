import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input, NumberInput } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { MuscleChip } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { MUSCLE_GROUPS, searchExercises } from '../lib/exercises'

// ─── Exercise Search ───────────────────────────────────────────────────────────
function ExerciseSearch({ onSelect, placeholder = 'Search exercises…' }) {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen]     = useState(false)
  const ref = useRef()

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setResults(searchExercises(q))
  }

  const pick = (ex) => {
    onSelect(ex)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="h-12 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
          placeholder:text-[#444] focus:outline-none focus:border-accent/50 transition-colors w-full"
      />
      {open && query.length > 0 && (
        <div className="absolute top-14 left-0 right-0 z-20 bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden shadow-2xl">
          {results.map(ex => (
            <button
              key={ex.name}
              onMouseDown={() => pick(ex)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#2e2e2e] flex items-center justify-center text-sm shrink-0">💪</div>
              <div>
                <p className="text-white text-sm font-medium">{ex.name}</p>
                <p className="text-[#555] text-xs">{ex.muscle}</p>
              </div>
            </button>
          ))}
          <button
            onMouseDown={() => pick({ name: query, muscle: '', img: null })}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] text-left transition-colors border-t border-[#2e2e2e]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#2e2e2e] flex items-center justify-center text-sm shrink-0">✏️</div>
            <p className="text-accent text-sm">Add "{query}" as custom</p>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Day Editor ────────────────────────────────────────────────────────────────
function DayEditor({ day, onChange }) {
  const [showSuperset, setShowSuperset] = useState(false)
  const [ssA, setSsA] = useState('')
  const [ssB, setSsB] = useState('')

  const addExercise = (ex) => {
    onChange({ ...day, exercises: [...day.exercises, { id: crypto.randomUUID(), name: ex.name, muscle: ex.muscle, is_superset: false, superset_group: null }] })
  }

  const addSuperset = () => {
    if (!ssA || !ssB) return
    const gid = crypto.randomUUID()
    onChange({
      ...day,
      exercises: [
        ...day.exercises,
        { id: crypto.randomUUID(), name: ssA, muscle: '', is_superset: true, superset_group: gid },
        { id: crypto.randomUUID(), name: ssB, muscle: '', is_superset: true, superset_group: gid },
      ]
    })
    setSsA(''); setSsB(''); setShowSuperset(false)
  }

  const removeExercise = (id) => {
    const ex = day.exercises.find(e => e.id === id)
    if (ex?.is_superset) {
      onChange({ ...day, exercises: day.exercises.filter(e => e.superset_group !== ex.superset_group) })
    } else {
      onChange({ ...day, exercises: day.exercises.filter(e => e.id !== id) })
    }
  }

  const toggleMuscle = (g) => {
    const curr = day.muscle_groups || []
    onChange({ ...day, muscle_groups: curr.includes(g) ? curr.filter(m => m !== g) : [...curr, g] })
  }

  // Group exercises for display
  const grouped = []
  const seen = new Set()
  for (const ex of day.exercises) {
    if (ex.is_superset && !seen.has(ex.superset_group)) {
      seen.add(ex.superset_group)
      const pair = day.exercises.filter(e => e.superset_group === ex.superset_group)
      grouped.push({ type: 'superset', pair })
    } else if (!ex.is_superset) {
      grouped.push({ type: 'exercise', ex })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <Input
        label="Day title"
        placeholder="e.g. Push Day, Upper Body, Legs…"
        value={day.title}
        onChange={e => onChange({ ...day, title: e.target.value })}
      />

      {/* Muscle groups */}
      <div>
        <p className="text-[#777] text-sm font-medium mb-2">Muscle Groups</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map(g => (
            <MuscleChip key={g} group={g}
              active={(day.muscle_groups || []).includes(g)}
              onClick={() => toggleMuscle(g)}
            />
          ))}
        </div>
      </div>

      {/* Exercises */}
      <div>
        <p className="text-[#777] text-sm font-medium mb-2">Exercises</p>
        <div className="flex flex-col gap-2 mb-3">
          {grouped.map((item, i) => {
            if (item.type === 'superset') {
              return (
                <div key={item.pair[0].superset_group} className="bg-[#1a1a1a] border border-accent/20 rounded-2xl p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-accent text-xs font-bold uppercase">Superset</span>
                    <button onClick={() => removeExercise(item.pair[0].id)} className="text-[#ff4f4f] text-xs hover:text-[#ff4f4f]">Remove</button>
                  </div>
                  {item.pair.map((p, pi) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-[#555] text-xs w-4">{pi === 0 ? 'A' : 'B'}</span>
                      <span className="text-white text-sm">{p.name}</span>
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div key={item.ex.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{item.ex.name}</p>
                  {item.ex.muscle && <p className="text-[#555] text-xs">{item.ex.muscle}</p>}
                </div>
                <button onClick={() => removeExercise(item.ex.id)} className="text-[#555] hover:text-[#ff4f4f] text-lg leading-none transition-colors">×</button>
              </div>
            )
          })}
        </div>

        <ExerciseSearch onSelect={addExercise} />

        <button
          onClick={() => setShowSuperset(!showSuperset)}
          className="mt-2 text-accent text-sm font-medium flex items-center gap-1"
        >
          {showSuperset ? '↑ Hide' : '+ Add Superset'}
        </button>

        {showSuperset && (
          <div className="mt-3 bg-[#1a1a1a] border border-accent/20 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-accent text-xs font-bold uppercase">Superset</p>
            <ExerciseSearch
              placeholder="Exercise A…"
              onSelect={ex => setSsA(ex.name)}
            />
            {ssA && <p className="text-white text-sm">A: {ssA}</p>}
            <ExerciseSearch
              placeholder="Exercise B…"
              onSelect={ex => setSsB(ex.name)}
            />
            {ssB && <p className="text-white text-sm">B: {ssB}</p>}
            <Button size="sm" variant="accent" onClick={addSuperset} disabled={!ssA || !ssB}>
              Add Superset
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Builder ──────────────────────────────────────────────────────────────
export default function PlanBuilderPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [step, setStep]     = useState(0)  // 0=info, 1=days
  const [name, setName]     = useState('')
  const [desc, setDesc]     = useState('')
  const [dayCount, setDayCount] = useState(4)
  const [days, setDays]     = useState([])
  const [activeDay, setActiveDay] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const initDays = () => {
    const d = Array.from({ length: dayCount }, (_, i) => ({
      day_number: i + 1, title: `Day ${i + 1}`, muscle_groups: [], exercises: [],
    }))
    setDays(d)
    setActiveDay(0)
    setStep(1)
  }

  const updateDay = (i, val) => {
    setDays(prev => prev.map((d, idx) => idx === i ? val : d))
  }

  const save = async () => {
    if (!name.trim()) { setError('Plan name is required'); return }
    setSaving(true)
    setError('')
    try {
      const { data: plan, error: pe } = await supabase.from('workout_plans')
        .insert({ user_id: user.id, name: name.trim(), description: desc.trim(), is_active: false })
        .select().single()
      if (pe) throw pe

      for (const day of days) {
        const { data: wd, error: de } = await supabase.from('workout_days')
          .insert({ plan_id: plan.id, day_number: day.day_number, title: day.title, muscle_groups: day.muscle_groups })
          .select().single()
        if (de) throw de

        if (day.exercises.length > 0) {
          const rows = day.exercises.map((ex, idx) => ({
            day_id: wd.id, exercise_name: ex.name, muscle_group: ex.muscle,
            order_index: idx, is_superset: ex.is_superset, superset_group: ex.superset_group,
          }))
          const { error: ee } = await supabase.from('day_exercises').insert(rows)
          if (ee) throw ee
        }
      }
      navigate('/plans')
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.')
    }
    setSaving(false)
  }

  // Step 0: Plan info
  if (step === 0) {
    return (
      <div className="flex flex-col gap-5 px-4 py-5">
        <div>
          <button onClick={() => navigate('/plans')} className="text-[#555] text-sm mb-3 flex items-center gap-1">← Back</button>
          <h1 className="text-xl font-bold text-white">New Plan</h1>
          <p className="text-[#555] text-sm mt-0.5">Step 1 of 2 — Plan details</p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Plan name"
            placeholder="e.g. PPL, Upper/Lower, Bro Split…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Input
            label="Description (optional)"
            placeholder="What's this plan about?"
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
          <div>
            <label className="text-sm text-[#777] font-medium block mb-1.5">Number of days</label>
            <div className="flex gap-2">
              {[2,3,4,5,6,7].map(n => (
                <button
                  key={n}
                  onClick={() => setDayCount(n)}
                  className={`h-12 flex-1 rounded-2xl text-lg font-bold transition-all active:scale-95 ${
                    dayCount === n
                      ? 'bg-accent text-black'
                      : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button size="xl" className="w-full mt-2" onClick={initDays} disabled={!name.trim()}>
          Set Up Days →
        </Button>
      </div>
    )
  }

  // Step 1: Day editor
  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 py-4 border-b border-[#1e1e1e]">
        <button onClick={() => setStep(0)} className="text-[#555] text-sm mb-2 flex items-center gap-1">← Back</button>
        <h1 className="text-xl font-bold text-white">{name}</h1>
        <p className="text-[#555] text-sm">Step 2 of 2 — Add exercises to each day</p>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-[#1e1e1e] scrollbar-hide shrink-0">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium transition-all ${
              activeDay === i ? 'bg-accent text-black' : 'bg-[#1e1e1e] text-[#777] border border-[#2e2e2e]'
            }`}
          >
            Day {i + 1}
          </button>
        ))}
      </div>

      {/* Day editor */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {days[activeDay] && (
          <DayEditor
            key={activeDay}
            day={days[activeDay]}
            onChange={val => updateDay(activeDay, val)}
          />
        )}
      </div>

      {/* Save footer */}
      <div className="px-4 py-4 border-t border-[#1e1e1e] bg-[#0a0a0a] shrink-0">
        {error && <p className="text-[#ff4f4f] text-sm mb-3">{error}</p>}
        <Button size="xl" className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Plan'}
        </Button>
      </div>
    </div>
  )
}
