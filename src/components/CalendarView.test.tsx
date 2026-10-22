import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import CalendarView from './CalendarView'
import type { Note } from '../lib/api'

it('shows accurate counts and selects or clears a date', async () => {
  const user = userEvent.setup(), onSelect = vi.fn(), onMonth = vi.fn()
  const entry: Note = { id: 'one', author_id: 'user', title: '', body: 'A page', entry_date: '2026-10-22', mood: 'heavy', visibility: 'private', image_path: null, image_url: null, created_at: '2026-10-22T00:00:00Z', updated_at: '2026-10-22T00:00:00Z', search_text: ' A page', author: null }
  const props = { month: new Date(2026, 9, 1), selected: '', entries: [entry, { ...entry, id: 'two' }], loading: false, onMonth, onSelect, onToday: vi.fn() }
  const { rerender } = render(<CalendarView {...props} />)
  await user.click(screen.getByRole('button', { name: 'October 22, 2026, 2 entries' }))
  expect(onSelect).toHaveBeenCalledWith('2026-10-22')
  rerender(<CalendarView {...props} selected="2026-10-22" />)
  await user.click(screen.getByRole('button', { name: 'October 22, 2026, 2 entries' }))
  expect(onSelect).toHaveBeenLastCalledWith('')
  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(onMonth).toHaveBeenCalledWith(-1)
})
