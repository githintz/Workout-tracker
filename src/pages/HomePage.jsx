import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MuscleChip } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import {
  checkAvailability,
  hasPermissions,
  requestPermissions,
  openSettings,
  syncAllSessions,
} from '../lib/healthConnect'

function WeeklyRing({ done, target }) {
  const pct = target > 0 ? Math.min(done / target, 1) : 0
  const r = 32, cx = 40, cy = 40, circ = 2 * Math.PI * r
  const dash = circ * pct
  const color = done >= target ? '#4fdf7c' : '#e8ff47'
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90 absolute inset-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth="5" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-white text-xl font-bold leading-none">{done}</span>
        <span className="text-[#555] text-[10px] leading-none mt-0.5">/{target}</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { user }    = useAuth()
  const { settings } = useSettings()
  const navigate    = useNavigate()
  const [plan, setPlan]       = useState(null)
  const [days, setDays]       = useState([])
  const [recent, setRecent]   = useState([])
  const [weekSessions, setWeekSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [todaySession, setTodaySession] = useState(null)

  const [hcStatus, setHcStatus]       = useState(null)
  const [hcConnected, setHcConnected] = useState(false)
  const [hcLoading, setHcLoading]     = useState(false)
  const [hcSyncing, setHcSyncing]     = useState(false)
  const [hcMessage, setHcMessage]     = useState('')

  useEffect(() => {
    if (!user) return
    loadData()
    initHealthConnect()
  }, [user])

  async function initHealthConnect() {
    const status = await checkAvailability()
    setHcStatus(status)
    if (status === 'Available') {
      setHcConnected(await hasPermissions())
    }
  }

  async function connectHealthConnect() {
    setHcLoading(true)
    setHcMessage('')
    const granted = await requestPermissions()
    setHcConnected(granted)
    setHcMessage(granted ? 'Connected! New workouts will sync automatically.' : 'Permission was not granted.')
    setHcLoading(false)
  }

  async function syncPastData() {
    setHcSyncing(true)
    setHcMessage('')
    const { synced, failed } = await syncAllSessions(supabase, user.id)
    if (synced === 0 && failed === 0) {
      setHcMessage('Everything is already synced.')
    } else {
      setHcMessage(`Synced ${synced} session${synced !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`)
    }
    setHcSyncing(false)
  }

  async function loadData() {
    setLoading(true)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
    const weekEnd   = endOfWeek(new Date(),   { weekStartsOn: 1 }).toISOString()

    const [{ data: planData }, { data: sessionData }, { data: weekData }] = await Promise.all([
      supabase.from('workout_plans').select('*').eq('user_id', user.id).eq('is_active', true).single(),
      supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(5),
      supabase.from('workout_sessions').select('id').eq('user_id', user.id).gte('started_at', weekStart).lte('started_at', weekEnd),
    ])
    setPlan(planData)
    setRecent(sessionData || [])
    setWeekSessions(weekData || [])

    if (planData) {
      const { data: dayData } = await supabase
        .from('workout_days').select('*').eq('plan_id', planData.id).order('day_number')
      setDays(dayData || [])
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    setTodaySession(sessionData?.find(s => s.started_at?.startsWith(today)) || null)
    setLoading(false)
  }

  if (loading) return <PageLoader />

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const weeklyTarget = settings.weekly_target || 4
  const weekDone     = weekSessions.length

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      {/* Greeting */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[#555] text-sm">{greeting()}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">{format(new Date(), 'EEEE, MMM d')}</h1>
        </div>
      </div>

      {/* Weekly target */}
      <Card className="flex items-center gap-5">
        <WeeklyRing done={weekDone} target={weeklyTarget} />
        <div className="flex-1">
          <p className="text-[#777] text-xs font-medium uppercase tracking-wider mb-0.5">This Week</p>
          <p className="text-white font-bold text-lg leading-tight">
            {weekDone >= weeklyTarget ? 'Target reached! 🎉' : `${weeklyTarget - weekDone} workout${weeklyTarget - weekDone !== 1 ? 's' : ''} to go`}
          </p>
          <p className="text-[#555] text-sm mt-0.5">{weekDone} of {weeklyTarget} workouts</p>
        </div>
      </Card>

      {/* Health Connect card */}
      {hcStatus && hcStatus !== 'NotSupported' && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">❤️</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Health Connect</p>
              <p className="text-[#555] text-xs">
                {hcConnected
                  ? 'Connected — new workouts sync automatically'
                  : hcStatus === 'NotInstalled'
                  ? 'Install Health Connect to enable sync'
                  : 'Sync workouts to Google Health'}
              </p>
            </div>
            {hcConnected && <span className="w-2 h-2 rounded-full bg-[#4fdf7c] shrink-0" />}
          </div>

          {hcStatus === 'NotInstalled' ? (
            <Button size="sm" variant="secondary" onClick={openSettings}>
              Open Health Connect
            </Button>
          ) : !hcConnected ? (
            <Button size="sm" onClick={connectHealthConnect} disabled={hcLoading}>
              {hcLoading ? 'Connecting…' : 'Connect to Health Connect'}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={syncPastData} disabled={hcSyncing}>
              {hcSyncing ? 'Syncing…' : 'Sync all past data'}
            </Button>
          )}

          {hcMessage && <p className="text-[#4fdf7c] text-xs">{hcMessage}</p>}
        </Card>
      )}

      {/* Active plan card */}
      {plan ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#555] text-xs font-medium uppercase tracking-wider mb-1">Active Plan</p>
              <p className="text-white font-bold text-xl">{plan.name}</p>
              <p className="text-[#444] text-sm mt-0.5">{days.length} days</p>
            </div>
            <span className="text-[#e8ff47] text-xs font-bold bg-[#e8ff47]/10 px-2 h-6 rounded-full flex items-center">ACTIVE</span>
          </div>

          <div className="flex flex-col gap-2">
            {days.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-1">
                <span className="text-[#444] text-xs w-12 shrink-0">Day {d.day_number}</span>
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
                <p className="text-[#444] text-xs">{todaySession.day_title}</p>
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
        {[
          { icon: '🎯', label: 'Track Workout', to: '/track' },
          { icon: '🏃', label: 'Log Cardio',    to: '/cardio' },
          { icon: '📊', label: 'Analytics',      to: '/analytics' },
          { icon: '📝', label: 'My Plans',       to: '/plans' },
        ].map(({ icon, label, to }) => (
          <Card key={to} onClick={() => navigate(to)} className="flex flex-col gap-2 items-center py-5 text-center">
            <span className="text-3xl">{icon}</span>
            <span className="text-white font-semibold text-sm">{label}</span>
          </Card>
        ))}
      </div>

      {/* Recent sessions */}
      {recent.length > 0 && (
        <div>
          <p className="text-[#555] text-xs font-medium uppercase tracking-wider mb-3">Recent Sessions</p>
          <div className="flex flex-col gap-2">
            {recent.slice(0, 3).map(s => (
              <Card key={s.id} className="flex items-center gap-3 py-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-lg shrink-0">💪</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{s.day_title || 'Workout'}</p>
                  <p className="text-[#444] text-xs">{format(new Date(s.started_at), 'EEE, MMM d')}</p>
                </div>
                {s.duration_seconds && (
                  <span className="text-[#555] text-xs shrink-0">{Math.round(s.duration_seconds / 60)}m</span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
