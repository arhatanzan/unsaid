import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { testNote, testSession } from '../test/fixtures'
import Journal from './Journal'

const mocks = vi.hoisted(() => ({
  session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
  getEntries: vi.fn(), getBookmarks: vi.fn(), getCalendarEntries: vi.fn(), saveEntry: vi.fn(),
  deleteEntry: vi.fn(), toggleBookmark: vi.fn(),
}))
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: mocks.session, loading: false }) }))
vi.mock('../lib/api', () => mocks)
vi.mock('../lib/supabase', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/supabase')>(),
  supabase: {},
}))
beforeEach(() => {
  localStorage.clear()
  mocks.getEntries.mockReset().mockResolvedValue({ entries: [testNote], count: 1 })
  mocks.getBookmarks.mockReset().mockResolvedValue([])
  mocks.getCalendarEntries.mockReset().mockResolvedValue([testNote])
  mocks.saveEntry.mockReset().mockResolvedValue({ id: testNote.id, warning: '' })
  mocks.toggleBookmark.mockReset().mockResolvedValue(undefined)
})
it('scopes queries to the journal and community independently', async () => {
  const { rerender } = render(<Journal scope="journal" onLogin={vi.fn()} />)
  await screen.findByRole('article')
  expect(mocks.getEntries).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'journal', userId: testSession.user.id }))
  rerender(<Journal scope="community" onLogin={vi.fn()} />)
  await waitFor(() => expect(mocks.getEntries).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'community' })))
})
it('passes combined sort, mood, visibility, search, and image filters to the backend', async () => {
  const user = userEvent.setup()
  render(<Journal scope="journal" onLogin={vi.fn()} />)
  await screen.findByRole('article')
  await user.selectOptions(screen.getByLabelText('Sort entries'), 'oldest')
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  const filterPanel = document.getElementById('entry-filters')!
  const { within } = await import('@testing-library/react')
  await user.selectOptions(within(filterPanel).getByLabelText('Mood'), 'hopeful')
  await user.selectOptions(within(filterPanel).getByLabelText('Visibility'), 'private')
  await user.click(screen.getByLabelText('With photographs'))
  await user.type(screen.getByRole('searchbox'), 'remember')
  await waitFor(() => expect(mocks.getEntries).toHaveBeenLastCalledWith(expect.objectContaining({
    filters: expect.objectContaining({ sort: 'oldest', mood: 'hopeful', visibility: 'private', images: true, search: 'remember' }),
  })))
})
it('shows errors and preserves an unsuccessful entry draft', async () => {
  const user = userEvent.setup()
  mocks.saveEntry.mockRejectedValue(new Error('Saving is unavailable.'))
  render(<Journal scope="journal" onLogin={vi.fn()} />)
  await screen.findByRole('article')
  await user.type(screen.getByRole('textbox', { name: 'Your thoughts' }), 'Please keep this.')
  await user.click(screen.getByRole('button', { name: 'Save to journal' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Saving is unavailable.')
  expect((screen.getByRole('textbox', { name: 'Your thoughts' }) as HTMLTextAreaElement).value).toBe('Please keep this.')
})
it('stores bookmarks in the account and filters by the server-backed IDs', async () => {
  const user = userEvent.setup()
  render(<Journal scope="journal" onLogin={vi.fn()} />)
  await screen.findByRole('article')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep this fragment close' })).toHaveProperty('disabled', false))
  await user.click(screen.getByRole('button', { name: 'Keep this fragment close' }))
  expect(mocks.toggleBookmark).toHaveBeenCalledWith(testSession.user.id, testNote.id, false)
  await user.click(screen.getByRole('button', { name: 'Kept close' }))
  await waitFor(() => expect(mocks.getEntries).toHaveBeenLastCalledWith(expect.objectContaining({
    savedIds: [testNote.id], filters: expect.objectContaining({ saved: true }),
  })))
})
it('reports invalid date ranges rather than treating them as an empty successful result', async () => {
  const user = userEvent.setup()
  render(<Journal scope="journal" onLogin={vi.fn()} />)
  await screen.findByRole('article')
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-31' } })
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-01' } })
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The start date must be on or before the end date.')
  expect(screen.queryByText('Gathering these pages…')).toBeNull()
})
