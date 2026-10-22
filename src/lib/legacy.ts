import { saveEntry, toggleBookmark } from './api'
import { localDate, parseLegacy, validateImage, validateImageUrl } from './journal'
import { getClient } from './supabase'

async function stableId(userId: string, oldId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userId}:legacy:${oldId}`)))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes.slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function importBrowserJournal(raw: string, userId: string, onProgress: (count: number) => void) {
  const notes = parseLegacy(raw)
  let count = 0
  for (const note of notes) {
    const id = await stableId(userId, note.id)
    const { data: existing, error } = await getClient().from('notes').select('id').eq('id', id).eq('author_id', userId).maybeSingle()
    if (error) throw error
    if (!existing) {
      let file: File | null = null
      let url: string | null = null
      if (note.image?.startsWith('data:image/')) {
        const response = await fetch(note.image)
        const blob = await response.blob()
        file = new File([blob], 'imported-memory', { type: blob.type })
        validateImage(file)
      } else if (note.image) url = validateImageUrl(note.image)
      await saveEntry(userId, { title: '', body: note.text, entry_date: localDate(new Date(note.date)), mood: 'reflective', visibility: 'private', image_url: url }, file, undefined, id)
    }
    if (note.saved) {
      const { data: bookmark, error: bookmarkError } = await getClient().from('bookmarks').select('note_id').eq('user_id', userId).eq('note_id', id).maybeSingle()
      if (bookmarkError) throw bookmarkError
      if (!bookmark) await toggleBookmark(userId, id, false)
    }
    onProgress(++count)
  }
  return count
}
