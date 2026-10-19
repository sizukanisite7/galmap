import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix: also read non-VITE_ vars (e.g. set in Vercel without the public prefix).
  const env = loadEnv(mode, process.cwd(), '')
  const url = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''
  const key = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? env.SUPABASE_ANON ?? ''

  return {
    plugins: [react()],
    // Only these two public values are embedded into the client bundle (never expose service_role here).
    define: {
      __SUPABASE_URL__: JSON.stringify(url),
      __SUPABASE_ANON_KEY__: JSON.stringify(key),
    },
  }
})
