import { useState, type FormEvent } from 'react'
import { Feather, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import Dialog from './Dialog'
import { useAuth } from '../lib/auth'
import { errorMessage, getClient, supabase } from '../lib/supabase'

export default function AccountDialog({ onClose }: { onClose: () => void }) {
  const { session, recovery, endRecovery } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>( 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const title = recovery ? 'A new beginning.' : session ? 'Your quiet corner.' : mode === 'signup' ? 'Make a place for yourself.' : mode === 'forgot' ? 'Find your way back.' : 'Welcome back.'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(''); setMessage(''); setBusy(true)
    try {
      const client = getClient()
      if (recovery) {
        const { error } = await client.auth.updateUser({ password })
        if (error) throw error
        endRecovery()
        setPassword('')
        setMessage('Your password has been updated.')
      } else if (mode === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/?auth=recovery` })
        if (error) throw error
        setMessage('If this email has an account, a recovery link will arrive shortly. Open it in this browser.')
      } else if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: {
          data: { display_name: name.trim() }, emailRedirectTo: location.origin,
        } })
        if (error) throw error
        if (data.session) onClose()
        else { setMessage('Check your email to confirm your account. Open the link in this browser, then sign in.'); setPassword('') }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        onClose()
      }
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  async function sessionAction(action: 'refresh' | 'local' | 'global') {
    setBusy(true); setError(''); setMessage('')
    try {
      const client = getClient()
      const { error } = action === 'refresh' ? await client.auth.refreshSession() : await client.auth.signOut({ scope: action })
      if (error) throw error
      if (action === 'refresh') setMessage('Your session has been refreshed.')
      else onClose()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return <Dialog title={title} onClose={() => { if (!busy) onClose() }}>
    <Feather className="dialog-feather" size={26} strokeWidth={1} />
    {!supabase ? <div className="notice"><p>Cloud accounts are not configured yet.</p><p>The site owner needs to add the Supabase public environment variables in Netlify, apply the database migration, and redeploy. No account or journal data will be stored locally as a substitute.</p></div> :
      session && !recovery ? <div className="account-details">
        <p className="account-name">{session.user.user_metadata.display_name || 'A quiet soul'}</p>
        <p className="break-words">{session.user.email}</p>
        <div className="session-card">
          <h3><ShieldCheck size={18} /> Current browser session</h3>
          <p>Signed in: {session.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString() : 'Just now'}</p>
          <p>Access token renews: {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Automatically'}</p>
          <p>Your session is restored on return and renewed automatically. Only use “stay signed in” behavior on a trusted device.</p>
        </div>
        <div className="account-actions">
          <button className="secondary-button" disabled={busy} onClick={() => void sessionAction('refresh')}><RefreshCw size={15} /> Refresh session</button>
          <button className="secondary-button" disabled={busy} onClick={() => void sessionAction('local')}><LogOut size={15} /> Sign out of this browser</button>
          <button className="danger-button" disabled={busy} onClick={() => void sessionAction('global')}>Sign out everywhere</button>
        </div>
        <p className="help-text">Signing out everywhere revokes refresh sessions. Existing access tokens on other devices can remain valid until they expire (typically up to one hour).</p>
      </div> :
        <form className="account-form" onSubmit={event => void submit(event)}>
          <p>{recovery ? 'Choose a new password to keep your journal safe.' : mode === 'signup' ? 'A private journal that stays with you, on any device. Your pen name appears on published entries and comments.' : mode === 'forgot' ? 'We will send you a secure password recovery link.' : 'Sign in to write, keep fragments close, and leave a kind word.'}</p>
          {mode === 'signup' && !recovery && <label>Pen name<input required value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="nickname" /></label>}
          {!recovery && <label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>}
          {(mode !== 'forgot' || recovery) && <label>{recovery ? 'New password' : 'Password'}<input type="password" required minLength={mode === 'signup' || recovery ? 8 : 1} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'} /></label>}
          {(mode === 'signup' || recovery) && <p className="help-text">At least 8 characters. Use a unique password.</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : recovery ? 'Update password' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send recovery link' : 'Sign in'}</button>
          {!recovery && <div className="auth-switches">
            <button type="button" disabled={busy} onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setMessage(''); setPassword('') }}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
            <button type="button" disabled={busy} onClick={() => { setMode(mode === 'forgot' ? 'login' : 'forgot'); setError(''); setMessage(''); setPassword('') }}>{mode === 'forgot' ? 'Return to sign in' : 'Forgot your password?'}</button>
          </div>}
          <p className="help-text">Sessions persist on this browser until you sign out. Your private entries are accessible only to your account; they are not end-to-end encrypted.</p>
        </form>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {message && <p className="inline-success" role="status">{message}</p>}
  </Dialog>
}
