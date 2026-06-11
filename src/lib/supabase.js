import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const akey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !akey) {
  console.warn('Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

let _client
try {
  _client = createClient(url || 'https://placeholder.supabase.co', akey || 'placeholder')
} catch (e) {
  console.error('Failed to init Supabase client:', e)
  _client = createClient('https://placeholder.supabase.co', 'placeholder')
}

export const supabase = _client
