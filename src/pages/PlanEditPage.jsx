import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { MUSCLE_GROUPS, searchExercises } from '../lib/exercises'

function ExerciseSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setResults(searchExercises(e.target.value)) }}
        placeholder="Search exercises…"
        className="h-12 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
          placeholder:text-[#444] focus:outline-none focus:border-[#e8ff47]/50 w-full"
      />
      {results.length > 0 && (
        <div className="absolute top-14 left-0 right-0 z-20 bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden shadow-2xl">
          {results.map(ex => (
            <button key={ex.name} onMouseDown={() => { onSelect(ex); setQuery(''); setResults([]) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] text-left">
              <span className="text-white text-sm">{ex.name}</span>
              <span className="text-[#555] text-xs ml-auto">{ex.muscle}</span>
            </button>
          ))}
          <button onMouseDown={() => { onSelect({ name: query, muscle: '' }); setQuery(''); setResults([]) }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] text-left border-t border-[#2e2e2e]">
            <span className="text-[#e8ff47] text-sm">Add "{query}" as custom</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function PlanEditPage() {
  const { id }     = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [plan, setPlan]     = useState(null)
  const [days, setDays]     = useState([])
  const [activeDay, setActiveDay] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPlan() }, [id])

  async function loadPlan() {
    const { data: p } = await supabase.from('workout_plans').select('*').eq('id', id).single()
    setPlan(p)
    const { data: d } = await supabase.from('workout_days').select('*, day_exercises(*)').eq('plan_id', id).order('day_number')
    const enriched = (d || []).map(day => ({
      ...day,
      exercises: (day.day_exercises || []).sort((a,b)=>a.order_index-b.order_index).map(e => ({
        id: e.id, name: e.exercise_name, muscle: e.muscle_group,
        is_superset: e.is_superset, superset_group: e.superset_group,
      }))
    }))
    setDays(enriched)
    setLoading(false)
  }

  const updateDayField = (i, field, val) => setDays(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const toggleMuscle = (i, g) => {
    const curr = days[i].muscle_groups || []
    updateDayField(i, 'muscle_groups', curr.includes(g) ? curr.filter(m => m !== g) : [...curr, g])
  }

  const addExercise = (i, ex) => {
    const exObj = { id: crypto.randomUUID(), name: ex.name, muscle: ex.muscle, is_superset: false, superset_group: null }
    updateDayField(i, 'exercises', [...days[i].exercises, exObj])
  }

  const removeExercise = (i, exId) => {
    const ex = days[i].exercises.find(e => e.id === exId)
    if (ex?.is_superset) {
      updateDayField(i, 'exercises', days[i].exercises.filter(e => e.superset_group !== ex.superset_group))
    } else {
      updateDayField(i, 'exercises', days[i].exercises.filter(e => e.id !== exId))
    }
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('workout_plans').update({ name: plan.name, description: plan.description }).eq('id', id)
    for (const day of days) {
      await supabase.from('workout_days').update({ title: day.title, muscle_groups: day.muscle_groups }).eq('id', day.id)
      await supabase.from('day_exercises').delete().eq('day_id', day.id)
      if (day.exercises.length > 0) {
        await supabase.from('day_exercises').insert(day.exercises.map((ex, idx) => ({
          day_id: day.id, exercise_name: ex.name, muscle_group: ex.muscle,
          order_index: idx, is_superset: ex.is_superset, superset_group: ex.superset_group,
        })))
      }
    }
    setSaving(false)
    navigate('/plans')
  }

  if (loading) return <PageLoader />

  const day = days[activeDay]

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-4 py-4 border-b border-[#1e1e1e]">
        <button onClick={() => navigate('/plans')} className="text-[#555] text-sm mb-2 flex items-center gap-1">← Plans</button>
        <Input
          value={plan?.name || ''}
          onChange={e => setPlan(p => ({ ...p, name: e.target.value }))}
          placeholder="Plan name"
        />
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-[#1e1e1e] shrink-0">
        {days.map((d, i) => (
          <button key={i} onClick={() => setActiveDay(i)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium transition-all ${
              activeDay === i ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] text-[#777] border border-[#2e2e2e]'
            }`}>
            Day {i + 1}
          </button>
        ))}
      </div>

      {day && (
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <Input label="Day title" value={day.title} onChange={e => updateDayField(activeDay, 'title', e.target.value)} />
          <div>
            <p className="text-[#777] text-sm font-medium mb-2">Muscle Groups</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map(g => (
                <MuscleChip key={g} group={g} active={(day.muscle_groups || []).includes(g)} onClick={() => toggleMuscle(activeDay, g)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[#777] text-sm font-medium mb-2">Exercises</p>
            <div className="flex flex-col gap-2 mb-3">
              {day.exercises.map(ex => (
                <div key={ex.id} className={`bg-[#1a1a1a] border ${ex.is_superset ? 'border-[#e8ff47]/20' : 'border-[#2e2e2e]'} rounded-2xl px-4 py-3 flex items-center justify-between`}>
                  <div>
                    {ex.is_superset && <span className="text-[#e8ff47] text-xs font-bold uppercase mr-2">SS</span>}
                    <span className="text-white text-sm">{ex.name}</span>
                  </div>
                  <button onClick={() => removeExercise(activeDay, ex.id)} className="text-[#555] hover:text-[#ff4f4f] text-lg">×</button>
                </div>
              ))}
            </div>
            <ExerciseSearch onSelect={ex => addExercise(activeDay, ex)} />
          </div>
        </div>
      )}

      <div className="px-4 py-4 border-t border-[#1e1e1e] bg-[#0a0a0a] shrink-0">
        <Button size="xl" className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
