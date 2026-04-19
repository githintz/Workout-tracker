import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const SettingsContext = createContext(null)

const DEFAULTS = { rest_timer_seconds: 90, weight_unit: 'kg' }

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)

  useEffect(() => {
    if (!user) return
    supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setSettings(data) })
  }, [user])

  const update = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    if (!user) return
    await supabase.from('user_settings').upsert({ user_id: user.id, ...next, updated_at: new Date() })
  }

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
