import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Composer from './Composer'

function renderComposer(overrides: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onLogin = vi.fn()
  render(<Composer busy={false} signedIn configured onSave={onSave} onLogin={onLogin} {...overrides} />)
  return { onSave, onLogin }
}
describe('writing pages', () => {
  it('saves privately by default and resets the draft only on success', async () => {
    const user = userEvent.setup()
    const { onSave } = renderComposer()
    await user.type(screen.getByRole('textbox', { name: 'Entry title' }), 'A quiet day')
    await user.type(screen.getByRole('textbox', { name: 'Your thoughts' }), 'Words to keep.')
    await user.click(screen.getByRole('button', { name: 'Save to journal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'A quiet day', body: 'Words to keep.', visibility: 'private' }), null, false)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your thoughts' }).getAttribute('value')).toBeNull())
    expect((screen.getByRole('textbox', { name: 'Your thoughts' }) as HTMLTextAreaElement).value).toBe('')
  })
  it('preserves writing and displays a failed cloud save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('Cloud unavailable'))
    renderComposer({ onSave })
    await user.type(screen.getByRole('textbox', { name: 'Your thoughts' }), 'Do not lose this.')
    await user.click(screen.getByRole('button', { name: 'Save to journal' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Cloud unavailable')
    expect((screen.getByRole('textbox', { name: 'Your thoughts' }) as HTMLTextAreaElement).value).toBe('Do not lose this.')
  })
  it('makes publishing explicit and returns to private after posting', async () => {
    const user = userEvent.setup()
    const { onSave } = renderComposer()
    await user.type(screen.getByRole('textbox', { name: 'Your thoughts' }), 'For everyone.')
    await user.selectOptions(screen.getByLabelText('Visibility'), 'public')
    expect(screen.getByText(/Published entries, your pen name/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publish fragment' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }), null, false)
    await waitFor(() => expect(screen.getByLabelText('Visibility')).toHaveProperty('value', 'private'))
  })
  it('requires login and never calls the save API as a guest', async () => {
    const user = userEvent.setup()
    const { onSave, onLogin } = renderComposer({ signedIn: false })
    await user.click(screen.getByRole('button', { name: 'Sign in to write' }))
    expect(onLogin).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })
  it('refuses an unattached URL instead of silently dropping it', async () => {
    const user = userEvent.setup()
    const { onSave } = renderComposer()
    await user.type(screen.getByRole('textbox', { name: 'Your thoughts' }), 'A memory.')
    await user.click(screen.getByRole('button', { name: 'Attach image by URL' }))
    await user.type(screen.getByRole('textbox', { name: 'Image URL' }), 'https://example.com/image.jpg')
    await user.click(screen.getByRole('button', { name: 'Save to journal' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Attach the image URL or close the URL field before saving.')
    expect(onSave).not.toHaveBeenCalled()
  })
  it('blocks an unavailable image until it is removed', async () => {
    const user = userEvent.setup()
    const { onSave } = renderComposer()
    await user.type(screen.getByRole('textbox', { name: 'Your thoughts' }), 'Keep the writing.')
    await user.click(screen.getByRole('button', { name: 'Attach image by URL' }))
    await user.type(screen.getByRole('textbox', { name: 'Image URL' }), 'https://example.com/missing.jpg')
    await user.click(screen.getByRole('button', { name: /^Attach$/ }))
    fireEvent.error(screen.getByAltText('Attached memory'))
    await user.click(screen.getByRole('button', { name: 'Save to journal' }))
    expect(onSave).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Remove attached image' }))
    await user.click(screen.getByRole('button', { name: 'Save to journal' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ image_url: null }), null, true)
  })
})
