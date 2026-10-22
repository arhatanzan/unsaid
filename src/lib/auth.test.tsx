import { act, render, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth'
import { testSession } from '../test/fixtures'

const state = vi.hoisted(() => ({
  callback: null as ((event: AuthChangeEvent, session: Session | null) => void) | null,
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock('./supabase', () => ({
  errorMessage: (error: Error) => error.message,
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof state.callback) => { state.callback = callback; return { data: { subscription: { unsubscribe: state.unsubscribe } } } },
      getSession: state.getSession,
    },
  },
}))
function Consumer() {
  const auth = useAuth()
  return <><span>{auth.loading ? 'restoring' : auth.session?.user.id ?? 'guest'}</span><span>{auth.recovery ? 'recovering' : 'normal'}</span>{auth.error && <p role="alert">{auth.error}</p>}</>
}
beforeEach(() => {
  state.getSession.mockReset().mockResolvedValue({ data: { session: testSession }, error: null })
})
it('restores a session and reacts to cross-tab sign-out', async () => {
  const { unmount } = render(<AuthProvider><Consumer /></AuthProvider>)
  await screen.findByText(testSession.user.id)
  act(() => state.callback?.('SIGNED_OUT', null))
  expect(screen.getByText('guest')).toBeTruthy()
  unmount()
  expect(state.unsubscribe).toHaveBeenCalled()
})
it('recognizes recovery and clears it on sign-out', async () => {
  render(<AuthProvider><Consumer /></AuthProvider>)
  await screen.findByText(testSession.user.id)
  act(() => state.callback?.('PASSWORD_RECOVERY', testSession))
  expect(screen.getByText('recovering')).toBeTruthy()
  act(() => state.callback?.('SIGNED_OUT', null))
  expect(screen.getByText('normal')).toBeTruthy()
})
it('surfaces restoration failure instead of silently pretending to restore a session', async () => {
  state.getSession.mockRejectedValue(new Error('Storage unavailable'))
  render(<AuthProvider><Consumer /></AuthProvider>)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your session could not be restored: Storage unavailable')
  expect(screen.getByText('guest')).toBeTruthy()
})
