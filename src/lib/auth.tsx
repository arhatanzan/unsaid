import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorMessage, supabase } from './supabase'

type AuthState = { session: Session | null; loading: boolean; error: string; recovery: boolean; endRecovery: () => void }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let active = true
    let eventReceived = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      eventReceived = true
      setSession(nextSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      else if (!eventReceived) setSession(data.session)
      setLoading(false)
    }).catch(cause => {
      if (active) { setError(`Your session could not be restored: ${errorMessage(cause)}`); setLoading(false) }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return <AuthContext.Provider value={{ session, loading, error, recovery, endRecovery: () => setRecovery(false) }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('Authentication must be used inside AuthProvider.')
  return auth
}
