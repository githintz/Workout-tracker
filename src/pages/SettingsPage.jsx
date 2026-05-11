import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

const REST_PRESETS = [30, 60, 90, 120, 180, 240]

export default function SettingsPage() {
  const { user, signOut }  = useAuth()
  const { settings, update } = useSettings()
  const [signingOut, setSigningOut] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('lift_theme') || 'dark')

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
  }

  const setRest = (secs) => update({ rest_timer_seconds: secs })
  const setUnit = (unit) => update({ weight_unit: unit })

  const toggleTheme = (next) => {
    setTheme(next)
    localStorage.setItem('lift_theme', next)
    if (next === 'light') document.documentElement.classList.add('light')
    else document.documentElement.classList.remove('light')
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      {/* Theme */}
      <Card>
        <p className="text-white font-semibold mb-1">Appearance</p>
        <p className="text-[#555] text-sm mb-4">Choose your preferred theme</p>
        <div className="flex gap-3">
          {[
            { key: 'dark',  label: '🌙 Dark'  },
            { key: 'light', label: '☀️ Light' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => toggleTheme(key)}
              className={`flex-1 h-12 rounded-2xl text-base font-semibold transition-all active:scale-95 ${
                theme === key ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Rest timer */}
      <Card>
        <p className="text-white font-semibold mb-1">Rest Timer</p>
        <p className="text-[#555] text-sm mb-4">Default duration between sets</p>
        <div className="flex flex-wrap gap-2">
          {REST_PRESETS.map(s => {
            const label = s >= 60 ? `${s/60}m` : `${s}s`
            const active = settings.rest_timer_seconds === s
            return (
              <button key={s} onClick={() => setRest(s)}
                className={`h-11 px-5 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                  active ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
                }`}>
                {label}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <p className="text-[#555] text-sm">Custom (seconds):</p>
          <input
            type="number"
            value={settings.rest_timer_seconds}
            onChange={e => setRest(parseInt(e.target.value) || 90)}
            className="w-20 h-10 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-center focus:outline-none focus:border-[#e8ff47]/50"
          />
        </div>
      </Card>

      {/* Weight unit */}
      <Card>
        <p className="text-white font-semibold mb-1">Weight Unit</p>
        <p className="text-[#555] text-sm mb-4">Used throughout tracking</p>
        <div className="flex gap-3">
          {['kg', 'lbs'].map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`flex-1 h-12 rounded-2xl text-base font-semibold transition-all active:scale-95 ${
                settings.weight_unit === u ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
              }`}>
              {u}
            </button>
          ))}
        </div>
      </Card>

      {/* Weekly target */}
      <Card>
        <p className="text-white font-semibold mb-1">Weekly Workout Target</p>
        <p className="text-[#555] text-sm mb-4">Number of workouts to aim for each week</p>
        <div className="flex gap-2">
          {[2,3,4,5,6,7].map(n => (
            <button key={n} onClick={() => update({ weekly_target: n })}
              className={`flex-1 h-11 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                settings.weekly_target === n ? 'bg-[#e8ff47] text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
              }`}>
              {n}
            </button>
          ))}
        </div>
      </Card>

      {/* Account */}
      <Card>
        <p className="text-white font-semibold mb-1">Account</p>
        <p className="text-[#555] text-sm mb-4">{user?.email}</p>
        <Button variant="danger" size="md" className="w-full" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </Button>
      </Card>

      {/* About */}
      <Card>
        <p className="text-white font-semibold mb-1">About</p>
        <p className="text-[#555] text-sm">LIFT — Personal Workout Tracker</p>
        <p className="text-[#333] text-xs mt-1">Built with React + Supabase</p>
      </Card>
    </div>
  )
}
