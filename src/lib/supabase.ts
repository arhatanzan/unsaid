import { createClient } from '@supabase/supabase-js'
import type { Database } from './database'

const projectUrl = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = projectUrl && publicKey
  ? createClient<Database>(projectUrl, publicKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null

export function getClient() {
  if (!supabase) throw new Error('Cloud journal is not configured. Add the Supabase public environment variables in Netlify and redeploy.')
  return supabase
}

export function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST205') {
    return 'The cloud journal tables have not been installed yet. The site owner needs to apply the Supabase journal migration.'
  }
  return error instanceof Error ? error.message :
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message : 'The request failed. Please try again.'
}
