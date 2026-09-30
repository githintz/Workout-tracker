import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'

const AuthContext = createContext(null)

const ANDROID_REDIRECT = 'com.lift.workouttracker://login-callback'

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // supabase-js's getSession() can hang indefinitely instead of resolving
    // (e.g. when it silently tries to refresh a stale token after long
    // inactivity), leaving the app stuck on the loading screen. Fall back
    // to the login screen if it takes too long; onAuthStateChange will
    // still update the user if the session resolves later.
    const timeout = setTimeout(() => setLoading(false), 8000)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeout)
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('getSession failed:', err)
        clearTimeout(timeout)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  // On Android, catch the magic link deep link and set the session
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let listenerHandle = null
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', ({ url }) => {
        const hash = url.split('#')[1]
        if (!hash) return
        const params = new URLSearchParams(hash)
        const access_token  = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          supabase.auth.setSession({ access_token, refresh_token })
        }
      }).then(handle => { listenerHandle = handle })
    })
    return () => { listenerHandle?.remove() }
  }, [])

  const signInWithEmail = (email) => {
    const redirectTo = Capacitor.isNativePlatform()
      ? ANDROID_REDIRECT
      : window.location.origin + import.meta.env.BASE_URL
    return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
