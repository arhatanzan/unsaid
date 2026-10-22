// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultFilters } from './journal'
import { deleteEntry, getCalendarEntries, getEntries, saveEntry, toggleBookmark } from './api'
import { testNote, testSession } from '../test/fixtures'

const network = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient<import('./database').Database>('https://test.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: network.fetch },
  })
  return { getClient: () => client }
})
function response(data: unknown, count = 1, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(0, count - 1)}/${count}` } })
}
beforeEach(() => {
  network.fetch.mockReset().mockResolvedValue(response([testNote]))
})
const query = { scope: 'journal' as const, userId: testSession.user.id, filters: defaultFilters, savedIds: [], page: 0 }

describe('cloud journal requests', () => {
  it('scopes private journal requests to the signed-in author', async () => {
    await getEntries(query)
    const url = new URL(String(network.fetch.mock.calls[0][0]))
    expect(url.searchParams.get('author_id')).toBe(`eq.${testSession.user.id}`)
    expect(url.searchParams.get('order')).toBe('entry_date.desc,created_at.desc,id.asc')
  })
  it('restricts the community query to public entries even for an authenticated owner', async () => {
    await getEntries({ ...query, scope: 'community', filters: { ...defaultFilters, visibility: 'private' } })
    const url = new URL(String(network.fetch.mock.calls[0][0]))
    expect(url.searchParams.get('visibility')).toBe('eq.public')
    expect(url.searchParams.has('author_id')).toBe(false)
  })
  it('combines search, mood, image, bookmark, date, and sort filters server-side', async () => {
    await getEntries({ ...query, savedIds: [testNote.id], page: 1, day: '2026-10-22', filters: {
      ...defaultFilters, search: '100%', mood: 'heavy', images: true, saved: true,
      visibility: 'private', from: '2026-10-01', to: '2026-10-31', sort: 'updated',
    } })
    const url = new URL(String(network.fetch.mock.calls[0][0]))
    expect(url.searchParams.get('search_text')).toBe('ilike.%100\\%%')
    expect(url.searchParams.get('mood')).toBe('eq.heavy')
    expect(url.searchParams.get('or')).toBe('(image_path.not.is.null,image_url.not.is.null)')
    expect(url.searchParams.get('id')).toContain(testNote.id)
    expect(url.searchParams.getAll('entry_date')).toEqual(['gte.2026-10-01', 'lte.2026-10-31', 'eq.2026-10-22'])
    expect(url.searchParams.get('order')).toBe('updated_at.desc,created_at.desc,id.asc')
    expect(url.searchParams.get('offset')).toBe('24')
    expect(url.searchParams.get('limit')).toBe('24')
  })
  it('does not query for a guest private journal or an empty bookmark list', async () => {
    expect(await getEntries({ ...query, userId: undefined })).toEqual({ entries: [], count: 0 })
    expect(await getEntries({ ...query, filters: { ...defaultFilters, saved: true } })).toEqual({ entries: [], count: 0 })
    expect(network.fetch).not.toHaveBeenCalled()
  })
  it('reads every page for calendar counts instead of truncating at the first page', async () => {
    network.fetch.mockResolvedValueOnce(response(Array.from({ length: 24 }, (_, i) => ({ ...testNote, id: `note-${i}` })), 25))
      .mockResolvedValueOnce(response([{ ...testNote, id: 'note-24' }], 25))
    const entries = await getCalendarEntries({ ...query, month: { from: '2026-10-01', to: '2026-10-31' } })
    expect(entries).toHaveLength(25)
    expect(network.fetch).toHaveBeenCalledTimes(2)
  })
  it('surfaces backend failures instead of returning an empty successful feed', async () => {
    network.fetch.mockResolvedValue(response({ message: 'Permission denied', code: '42501' }, 0, 403))
    await expect(getEntries(query)).rejects.toHaveProperty('message', 'Permission denied')
  })
  it('updates an existing entry, including removal of an uploaded image', async () => {
    network.fetch.mockResolvedValueOnce(response({ id: testNote.id })).mockResolvedValueOnce(response([]))
    await saveEntry(testSession.user.id, { title: 'Edited', body: 'New words', entry_date: '2026-10-22', mood: 'peaceful', visibility: 'private', image_url: null }, null, { ...testNote, image_path: `${testSession.user.id}/image` }, undefined, true)
    expect(network.fetch.mock.calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(network.fetch.mock.calls[0][1].body)).toMatchObject({ title: 'Edited', image_path: null })
    expect(network.fetch.mock.calls[1][1].method).toBe('DELETE')
  })
  it('cleans up a new upload if its entry cannot be saved', async () => {
    network.fetch.mockResolvedValueOnce(response({ Key: 'journal-images/new-image', Id: 'uploaded-id' }))
      .mockResolvedValueOnce(response({ message: 'Cannot save entry', code: '42501' }, 0, 403))
      .mockResolvedValueOnce(response([]))
    const file = new File(['image'], 'image.png', { type: 'image/png' })
    await expect(saveEntry(testSession.user.id, {
      title: '', body: 'Words', entry_date: '2026-10-22', mood: 'reflective', visibility: 'private', image_url: null,
    }, file)).rejects.toHaveProperty('message', 'Cannot save entry')
    expect(network.fetch).toHaveBeenCalledTimes(3)
    expect(network.fetch.mock.calls[2][1].method).toBe('DELETE')
  })
  it('reports partial cleanup failures explicitly after a successful deletion', async () => {
    network.fetch.mockResolvedValueOnce(response({ id: testNote.id }))
      .mockResolvedValueOnce(response({ message: 'Image removal denied' }, 0, 403))
    const result = await deleteEntry({ ...testNote, image_path: `${testSession.user.id}/image` }, testSession.user.id)
    expect(result.id).toBe(testNote.id)
    expect(result.warning).toContain('Entry deleted, but its uploaded image could not be removed')
  })
  it('does not report success for an entry that could not be deleted', async () => {
    network.fetch.mockResolvedValue(response({ message: 'No accessible entry', code: 'PGRST116' }, 0, 406))
    await expect(deleteEntry(testNote, testSession.user.id)).rejects.toHaveProperty('message', 'No accessible entry')
  })
  it('deletes the uploaded image after a successful entry deletion', async () => {
    network.fetch.mockResolvedValueOnce(response({ id: testNote.id })).mockResolvedValueOnce(response([]))
    const result = await deleteEntry({ ...testNote, image_path: `${testSession.user.id}/image` }, testSession.user.id)
    expect(result.warning).toBe('')
    expect(network.fetch.mock.calls[1][1].method).toBe('DELETE')
  })
  it('saves bookmarks on the server for the authenticated account', async () => {
    network.fetch.mockResolvedValue(response(null))
    await toggleBookmark(testSession.user.id, testNote.id, false)
    expect(network.fetch.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(network.fetch.mock.calls[0][1].body)).toEqual({ user_id: testSession.user.id, note_id: testNote.id })
  })
})
