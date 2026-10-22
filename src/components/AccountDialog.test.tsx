import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { testSession } from '../test/fixtures'
import AccountDialog from './AccountDialog'

const mocks = vi.hoisted(() => ({
  state: { session: null as Session | null, recovery: false, endRecovery: vi.fn() },
  auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() },
}))
vi.mock('../lib/auth', () => ({ useAuth: () => mocks.state }))
vi.mock('../lib/supabase', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/supabase')>(),
  supabase: {},
  getClient: () => ({ auth: mocks.auth }),
}))
beforeEach(() => {
  mocks.state.session = null; mocks.state.recovery = false
  Object.values(mocks.auth).forEach(mock => mock.mockReset().mockResolvedValue({ error: null }))
})
describe('account and session flows', () => {
  it('signs in with email and password', async () => {
    const user = userEvent.setup(), onClose = vi.fn()
    render(<AccountDialog onClose={onClose} />)
    await user.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await user.type(screen.getByLabelText('Password'), 'test-password')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'reader@example.com', password: 'test-password' })
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('creates an account and asks for email confirmation, not a fake session', async () => {
    const user = userEvent.setup(), onClose = vi.fn()
    mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
    render(<AccountDialog onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'New here? Create an account' }))
    await user.type(screen.getByLabelText('Pen name'), 'A reader')
    await user.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await user.type(screen.getByLabelText('Password'), 'test-password')
    await user.click(screen.getByRole('button', { name: /^Create account$/ }))
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Check your email'))
    expect(mocks.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { display_name: 'A reader' }, emailRedirectTo: location.origin } }))
    expect(onClose).not.toHaveBeenCalled()
  })
  it('surfaces invalid credentials', async () => {
    const user = userEvent.setup()
    mocks.auth.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') })
    render(<AccountDialog onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Invalid login credentials')
  })
  it('requests recovery with the current site redirect', async () => {
    const user = userEvent.setup()
    render(<AccountDialog onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    await user.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await user.click(screen.getByRole('button', { name: 'Send recovery link' }))
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('reader@example.com', { redirectTo: `${location.origin}/?auth=recovery` })
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('If this email has an account'))
  })
  it('updates a password after the recovery event', async () => {
    const user = userEvent.setup()
    mocks.state.session = testSession; mocks.state.recovery = true
    render(<AccountDialog onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('New password'), 'new-test-password')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: 'new-test-password' })
    expect(mocks.state.endRecovery).toHaveBeenCalled()
  })
  it('refreshes and can revoke all account sessions', async () => {
    const user = userEvent.setup(), onClose = vi.fn()
    mocks.state.session = testSession
    render(<AccountDialog onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Refresh session' }))
    expect(mocks.auth.refreshSession).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('can sign out only the current browser', async () => {
    const user = userEvent.setup()
    mocks.state.session = testSession
    render(<AccountDialog onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Sign out of this browser' }))
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
