import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const akey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !akey) {
  console.warn('Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

// supabase-js coordinates token refreshes across tabs with a
// navigator.locks mutex that can get orphaned (e.g. a tab discarded mid
// refresh) and never release, causing every subsequent auth-gated call
// (getSession, queries, etc.) to hang forever. This is a single-tab app,
// so skip the lock entirely instead of risking a permanent deadlock.
const noOpLock = async (_name, _acquireTimeout, fn) => fn()

let _client
try {
  _client = createClient(url || 'https://placeholder.supabase.co', akey || 'placeholder', {
    auth: { lock: noOpLock },
  })
} catch (e) {
  console.error('Failed to init Supabase client:', e)
  _client = createClient('https://placeholder.supabase.co', 'placeholder', {
    auth: { lock: noOpLock },
  })
}

export const supabase = _client
