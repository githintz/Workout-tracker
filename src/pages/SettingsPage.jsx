import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Capacitor } from '@capacitor/core'
import {
  checkAvailability,
  hasPermissions,
  requestPermissions,
  openSettings as openHcSettings,
  syncAllSessions,
} from '../lib/healthConnect'
import { supabase } from '../lib/supabase'
import { ACCENTS, applyAccent, getAccentKey } from '../lib/theme'

const REST_PRESETS = [30, 60, 90, 120, 180, 240]

export default function SettingsPage() {
  const { user, signOut }  = useAuth()
  const { settings, update } = useSettings()
  const [signingOut, setSigningOut] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('lift_theme') || 'dark')
  const [accent, setAccent] = useState(getAccentKey)

  const [shares, setShares]         = useState([])
  const [shareEmail, setShareEmail] = useState('')
  const [shareMsg, setShareMsg]     = useState('')
  const [shareBusy, setShareBusy]   = useState(false)

  const [hcStatus, setHcStatus]       = useState(null)
  const [hcConnected, setHcConnected] = useState(false)
  const [hcLoading, setHcLoading]     = useState(false)
  const [hcSyncing, setHcSyncing]     = useState(false)
  const [hcMessage, setHcMessage]     = useState('')

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    checkAvailability().then(status => {
      setHcStatus(status)
      if (status === 'Available') hasPermissions().then(setHcConnected)
    })
  }, [])

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

  const chooseAccent = (key) => {
    setAccent(key)
    applyAccent(key)
  }

  useEffect(() => {
    if (!user) return
    loadShares()
  }, [user])

  async function loadShares() {
    const { data } = await supabase.from('shared_access').select('*')
      .eq('owner_id', user.id).order('created_at')
    setShares(data || [])
  }

  async function addShare(e) {
    e.preventDefault()
    const email = shareEmail.trim().toLowerCase()
    if (!email) return
    if (email === user.email?.toLowerCase()) {
      setShareMsg("That's your own email.")
      return
    }
    setShareBusy(true)
    setShareMsg('')
    const { error } = await supabase.from('shared_access')
      .insert({ owner_id: user.id, owner_email: user.email, viewer_email: email })
    if (error) {
      setShareMsg(error.code === '23505' ? 'Already shared with this email.' : `Could not share: ${error.message}`)
    } else {
      setShareEmail('')
      await loadShares()
    }
    setShareBusy(false)
  }

  async function removeShare(id) {
    await supabase.from('shared_access').delete().eq('id', id)
    loadShares()
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
                theme === key ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <p className="text-[#555] text-sm mt-5 mb-3">Accent color</p>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(ACCENTS).map(([key, a]) => (
            <button key={key} onClick={() => chooseAccent(key)} aria-label={a.name} title={a.name}
              className={`w-10 h-10 rounded-full transition-all active:scale-90 ${
                accent === key ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111]' : ''
              }`}
              style={{ background: a.hex }} />
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
                  active ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
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
            className="w-20 h-10 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-center focus:outline-none focus:border-accent/50"
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
                settings.weight_unit === u ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
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
                settings.weekly_target === n ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
              }`}>
              {n}
            </button>
          ))}
        </div>
      </Card>

      {/* Health Connect — Android only */}
      {Capacitor.isNativePlatform() && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">❤️</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Health Connect</p>
              <p className="text-[#555] text-xs">
                {hcStatus === null            ? 'Checking…'
                  : hcConnected              ? 'Connected — workouts & steps sync automatically'
                  : hcStatus === 'NotInstalled' ? 'Install Health Connect to enable sync'
                  : hcStatus === 'NotSupported' ? 'Not supported on this device'
                  : 'Sync workouts and steps to Google Health'}
              </p>
            </div>
            {hcConnected && <span className="w-2 h-2 rounded-full bg-[#4fdf7c] shrink-0" />}
          </div>

          {hcStatus === 'NotInstalled' && (
            <Button size="sm" variant="secondary" onClick={openHcSettings}>Open Health Connect</Button>
          )}
          {hcStatus === 'Available' && !hcConnected && (
            <Button size="sm" onClick={connectHealthConnect} disabled={hcLoading}>
              {hcLoading ? 'Connecting…' : 'Connect to Health Connect'}
            </Button>
          )}
          {hcStatus === 'Available' && hcConnected && (
            <Button size="sm" variant="secondary" onClick={syncPastData} disabled={hcSyncing}>
              {hcSyncing ? 'Syncing…' : 'Sync all past data'}
            </Button>
          )}

          {hcMessage && <p className="text-[#4fdf7c] text-xs">{hcMessage}</p>}
        </Card>
      )}

      {/* Physiotherapist access */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🩺</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Physiotherapist Access</p>
            <p className="text-[#555] text-xs">
              Give someone read-only access to your workout and cardio logs. They sign in with
              their own email using Physiotherapist mode on the login screen.
            </p>
          </div>
        </div>

        {shares.length > 0 && (
          <div className="flex flex-col gap-2">
            {shares.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-[#1a1a1a] rounded-2xl px-3 py-2">
                <p className="text-white text-sm flex-1 min-w-0 truncate">{s.viewer_email}</p>
                <button onClick={() => removeShare(s.id)}
                  className="text-[#ff4f4f] text-xs font-semibold shrink-0 active:scale-95">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addShare} className="flex gap-2">
          <input
            type="email"
            placeholder="physio@example.com"
            value={shareEmail}
            onChange={e => setShareEmail(e.target.value)}
            required
            className="flex-1 h-11 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm focus:outline-none focus:border-accent/50"
          />
          <Button type="submit" size="sm" disabled={shareBusy}>
            {shareBusy ? 'Adding…' : 'Share'}
          </Button>
        </form>

        {shareMsg && <p className="text-[#ff8c42] text-xs">{shareMsg}</p>}
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
