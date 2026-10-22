import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { testNote, testSession } from '../test/fixtures'
import CommentsDialog from './CommentsDialog'

const api = vi.hoisted(() => ({ getComments: vi.fn(), postComment: vi.fn(), deleteComment: vi.fn() }))
vi.mock('../lib/api', () => api)
beforeEach(() => {
  api.getComments.mockReset().mockResolvedValue({ comments: [], count: 0 })
  api.postComment.mockReset().mockResolvedValue(undefined)
})
it('requires guests to sign in before posting', async () => {
  const user = userEvent.setup(), onLogin = vi.fn()
  render(<CommentsDialog note={{ ...testNote, visibility: 'public' }} onClose={vi.fn()} onLogin={onLogin} />)
  await user.click(await screen.findByRole('button', { name: 'Sign in to comment' }))
  expect(onLogin).toHaveBeenCalledOnce()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(api.postComment).not.toHaveBeenCalled()
})
it('posts comments for the signed-in account and reloads the conversation', async () => {
  const user = userEvent.setup()
  render(<CommentsDialog note={{ ...testNote, visibility: 'public' }} userId={testSession.user.id} onClose={vi.fn()} onLogin={vi.fn()} />)
  await user.type(screen.getByLabelText('Leave a kind word'), 'You are heard.')
  await user.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(api.postComment).toHaveBeenCalledWith(testNote.id, testSession.user.id, 'You are heard.')
  expect((screen.getByLabelText('Leave a kind word') as HTMLTextAreaElement).value).toBe('')
  expect(api.getComments.mock.calls.length).toBeGreaterThanOrEqual(2)
})
it('preserves the comment draft on a failed post', async () => {
  const user = userEvent.setup()
  api.postComment.mockRejectedValue(new Error('This entry is no longer public.'))
  render(<CommentsDialog note={{ ...testNote, visibility: 'public' }} userId={testSession.user.id} onClose={vi.fn()} onLogin={vi.fn()} />)
  await user.type(screen.getByLabelText('Leave a kind word'), 'A kind word.')
  await user.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('no longer public'))
  expect((screen.getByLabelText('Leave a kind word') as HTMLTextAreaElement).value).toBe('A kind word.')
})
