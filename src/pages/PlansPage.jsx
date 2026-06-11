import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'

export default function PlansPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [plans, setPlans]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPlans() }, [user])

  async function loadPlans() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('workout_plans').select('*, workout_days(*)')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  async function setActive(planId) {
    await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', user.id)
    await supabase.from('workout_plans').update({ is_active: true }).eq('id', planId)
    loadPlans()
  }

  async function deletePlan(planId) {
    if (!confirm('Delete this plan? This cannot be undone.')) return
    await supabase.from('workout_plans').delete().eq('id', planId)
    setPlans(p => p.filter(x => x.id !== planId))
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">My Plans</h1>
        <Button size="sm" onClick={() => navigate('/plans/new')}>+ New Plan</Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No plans yet"
          subtitle="Create your first workout plan to get started"
          action={<Button onClick={() => navigate('/plans/new')}>Create a Plan</Button>}
        />
      ) : (
        plans.map(plan => {
          const allMuscles = [...new Set((plan.workout_days || []).flatMap(d => d.muscle_groups || []))]
          return (
            <Card key={plan.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-lg truncate">{plan.name}</p>
                    {plan.is_active && (
                      <span className="text-accent text-xs font-bold bg-accent/10 px-2 h-5 rounded-full flex items-center shrink-0">ACTIVE</span>
                    )}
                  </div>
                  {plan.description && <p className="text-[#555] text-sm mt-0.5 truncate">{plan.description}</p>}
                  <p className="text-[#555] text-xs mt-1">{plan.workout_days?.length || 0} days</p>
                </div>
              </div>

              {/* Days list */}
              {plan.workout_days?.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {[...plan.workout_days].sort((a,b)=>a.day_number-b.day_number).map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <span className="text-[#555] text-xs w-10 shrink-0">Day {d.day_number}</span>
                      <span className="text-[#aaa] text-sm flex-1 truncate">{d.title}</span>
                      <div className="flex gap-1">
                        {d.muscle_groups?.slice(0,2).map(g => <MuscleChip key={g} group={g} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {!plan.is_active && (
                  <Button size="sm" variant="accent" onClick={() => setActive(plan.id)}>Set Active</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => navigate(`/plans/${plan.id}/edit`)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => deletePlan(plan.id)}>Delete</Button>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
