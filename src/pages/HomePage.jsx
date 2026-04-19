import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { format } from 'date-fns'

export default function HomePage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [plan, setPlan]       = useState(null)
  const [days, setDays]       = useState([])
  const [recent, setRecent]   = useState([])
  const [loading, setLoading] = useState(true)
  const [todaySession, setTodaySession] = useState(null)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    const [{ data: planData }, { data: sessionData }] = await Promise.all([
      supabase.from('workout_plans').select('*').eq('user_id', user.id).eq('is_active', true).single(),
      supabase.from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(5),
    ])
    setPlan(planData)
    setRecent(sessionData || [])

    if (planData) {
      const { data: dayData } = await supabase
        .from('workout_days').select('*')
        .eq('plan_id', planData.id).order('day_number')
      setDays(dayData || [])
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    const todaySess = sessionData?.find(s => s.started_at?.startsWith(today))
    setTodaySession(todaySess || null)
    setLoading(false)
  }

  if (loading) return <PageLoader />

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      {/* Greeting */}
      <div>
        <p className="text-[#777] text-sm">{greeting()}</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">
          {format(new Date(), 'EEEE, MMM d')}
        </h1>
      </div>

      {/* Active plan card */}
      {plan ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#777] text-xs font-medium uppercase tracking-wider mb-1">Active Plan</p>
              <p className="text-white font-bold text-xl">{plan.name}</p>
              <p className="text-[#555] text-sm mt-0.5">{days.length} days</p>
            </div>
            <span className="text-[#e8ff47] text-xs font-bold bg-[#e8ff47]/10 px-2 h-6 rounded-full flex items-center">ACTIVE</span>
          </div>

          {/* Day chips */}
          <div className="flex flex-col gap-2">
            {days.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-[#555] text-xs w-12 shrink-0">Day {d.day_number}</span>
                <span className="text-white text-sm font-medium flex-1">{d.title}</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {d.muscle_groups?.slice(0,2).map(g => <MuscleChip key={g} group={g} />)}
                </div>
              </div>
            ))}
          </div>

          {todaySession ? (
            <div className="bg-[#4fdf7c]/10 border border-[#4fdf7c]/20 rounded-2xl p-3 flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-[#4fdf7c] font-semibold text-sm">Workout logged today!</p>
                <p className="text-[#555] text-xs">{todaySession.day_title}</p>
              </div>
            </div>
          ) : (
            <Button size="xl" className="w-full" onClick={() => navigate('/track')}>
              Start Today's Workout
            </Button>
          )}
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 items-center py-8 text-center">
          <div className="text-5xl">📋</div>
          <div>
            <p className="text-white font-semibold text-lg">No active plan</p>
            <p className="text-[#555] text-sm mt-1">Create a plan and set it as active to get started</p>
          </div>
          <Button onClick={() => navigate('/plans/new')}>Create a Plan</Button>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => navigate('/track')} className="flex flex-col gap-2 items-center py-5 text-center">
          <span className="text-3xl">🎯</span>
          <span className="text-white font-semibold text-sm">Track Workout</span>
        </Card>
        <Card onClick={() => navigate('/cardio')} className="flex flex-col gap-2 items-center py-5 text-center">
          <span className="text-3xl">🏃</span>
          <span className="text-white font-semibold text-sm">Log Cardio</span>
        </Card>
        <Card onClick={() => navigate('/analytics')} className="flex flex-col gap-2 items-center py-5 text-center">
          <span className="text-3xl">📊</span>
          <span className="text-white font-semibold text-sm">Analytics</span>
        </Card>
        <Card onClick={() => navigate('/plans')} className="flex flex-col gap-2 items-center py-5 text-center">
          <span className="text-3xl">📝</span>
          <span className="text-white font-semibold text-sm">My Plans</span>
        </Card>
      </div>

      {/* Recent sessions */}
      {recent.length > 0 && (
        <div>
          <p className="text-[#777] text-xs font-medium uppercase tracking-wider mb-3">Recent Sessions</p>
          <div className="flex flex-col gap-2">
            {recent.slice(0, 3).map(s => (
              <Card key={s.id} className="flex items-center gap-3 py-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1e1e1e] flex items-center justify-center text-lg shrink-0">💪</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{s.day_title || 'Workout'}</p>
                  <p className="text-[#555] text-xs">{format(new Date(s.started_at), 'EEE, MMM d')}</p>
                </div>
                {s.duration_seconds && (
                  <span className="text-[#777] text-xs shrink-0">
                    {Math.round(s.duration_seconds / 60)}m
                  </span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
