import { createClient } from '@supabase/supabase-js'

// Injected at build time by vite.config.ts (supports VITE_* and plain SUPABASE_* env names).
declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

const url = __SUPABASE_URL__
const key = __SUPABASE_ANON_KEY__

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
})
