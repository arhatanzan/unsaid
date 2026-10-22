import type { NoteRow, CommentRow } from './database'
import { escapeSearch, PAGE_SIZE, type Filters, type Scope } from './journal'
import { getClient } from './supabase'

export type Note = NoteRow & { author: { display_name: string } | null; imageSrc?: string }
export type Comment = CommentRow & { author: { display_name: string } | null }
export type EntryInput = Pick<NoteRow, 'title' | 'body' | 'entry_date' | 'mood' | 'visibility' | 'image_url'>
export type EntryQuery = { scope: Scope; userId?: string; filters: Filters; savedIds: string[]; page: number; month?: { from: string; to: string }; day?: string; hydrateImages?: boolean }

export async function getBookmarks(userId: string) {
  const client = getClient()
  const ids: string[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await client.from('bookmarks').select('note_id').eq('user_id', userId).order('note_id').range(page * 500, page * 500 + 499)
    if (error) throw error
    ids.push(...data.map(item => item.note_id))
    if (data.length < 500) return ids
  }
}

export async function getEntries({ scope, userId, filters, savedIds, page, month, day, hydrateImages = true }: EntryQuery) {
  if ((scope === 'journal' && !userId) || (filters.saved && savedIds.length === 0)) return { entries: [], count: 0 }
  let query = getClient().from('notes').select('*, author:profiles!notes_author_id_fkey(display_name)', { count: 'exact' })
  if (scope === 'journal' && userId) query = query.eq('author_id', userId)
  else query = query.eq('visibility', 'public')
  if (filters.search.trim()) query = query.ilike('search_text', `%${escapeSearch(filters.search.trim())}%`)
  if (filters.mood) query = query.eq('mood', filters.mood)
  if (scope === 'journal' && filters.visibility) query = query.eq('visibility', filters.visibility)
  if (filters.images) query = query.or('image_path.not.is.null,image_url.not.is.null')
  if (filters.saved) query = query.in('id', savedIds)
  if (filters.from) query = query.gte('entry_date', filters.from)
  if (filters.to) query = query.lte('entry_date', filters.to)
  if (month) query = query.gte('entry_date', month.from).lte('entry_date', month.to)
  if (day) query = query.eq('entry_date', day)
  query = query.order(filters.sort === 'updated' ? 'updated_at' : 'entry_date', { ascending: filters.sort === 'oldest' })
    .order('created_at', { ascending: filters.sort === 'oldest' }).order('id')
  const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (error) throw error
  const entries = await Promise.all(data.map(async (note): Promise<Note> => {
    if (!hydrateImages) return note
    if (!note.image_path) return { ...note, imageSrc: note.image_url ?? undefined }
    const { data: image, error: imageError } = await getClient().storage.from('journal-images').createSignedUrl(note.image_path, 300)
    if (imageError) throw new Error(`An entry image could not be loaded: ${imageError.message}`)
    return { ...note, imageSrc: image.signedUrl }
  }))
  return { entries, count: count ?? 0 }
}

export async function getCalendarEntries(query: EntryQuery) {
  const entries: Note[] = []
  for (let page = 0; ; page++) {
    const result = await getEntries({ ...query, page, hydrateImages: false })
    entries.push(...result.entries)
    if (entries.length >= result.count || result.entries.length === 0) return entries
  }
}

export async function saveEntry(userId: string, input: EntryInput, file: File | null, existing?: Note, newId?: string, removeImage = false) {
  const client = getClient()
  const id = existing?.id ?? newId ?? crypto.randomUUID()
  let imagePath = removeImage ? null : existing?.image_path ?? null
  let uploadedPath: string | null = null
  if (file) {
    uploadedPath = `${userId}/${id}/${crypto.randomUUID()}`
    const { error } = await client.storage.from('journal-images').upload(uploadedPath, file, { contentType: file.type, upsert: false })
    if (error) throw error
    imagePath = uploadedPath
  }
  if (input.image_url) imagePath = null
  const fields = { ...input, image_path: imagePath }
  const request = existing
    ? client.from('notes').update(fields).eq('id', id).eq('author_id', userId)
    : client.from('notes').insert({ ...fields, id, author_id: userId })
  const { data, error } = await request.select('id').single()
  if (error) {
    if (uploadedPath) {
      const { error: cleanupError } = await client.storage.from('journal-images').remove([uploadedPath])
      if (cleanupError) throw new Error(`${error.message} The unused upload could not be removed: ${cleanupError.message}`)
    }
    throw error
  }
  if (existing?.image_path && existing.image_path !== imagePath) {
    const { error: cleanupError } = await client.storage.from('journal-images').remove([existing.image_path])
    if (cleanupError) return { id: data.id, warning: `Entry saved, but the previous upload could not be removed: ${cleanupError.message}` }
  }
  return { id: data.id, warning: '' }
}

export async function deleteEntry(note: Note, userId: string) {
  const client = getClient()
  const { data, error } = await client.from('notes').delete().eq('id', note.id).eq('author_id', userId).select('id').single()
  if (error) throw error
  if (note.image_path) {
    const { error: imageError } = await client.storage.from('journal-images').remove([note.image_path])
    if (imageError) return { id: data.id, warning: `Entry deleted, but its uploaded image could not be removed: ${imageError.message}` }
  }
  return { id: data.id, warning: '' }
}

export async function toggleBookmark(userId: string, noteId: string, saved: boolean) {
  const client = getClient()
  const { error } = saved
    ? await client.from('bookmarks').delete().eq('user_id', userId).eq('note_id', noteId)
    : await client.from('bookmarks').insert({ user_id: userId, note_id: noteId })
  if (error) throw error
}

export async function getComments(noteId: string, page: number) {
  const { data, count, error } = await getClient().from('comments')
    .select('*, author:profiles!comments_author_id_fkey(display_name)', { count: 'exact' })
    .eq('note_id', noteId).order('created_at').order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (error) throw error
  return { comments: data, count: count ?? 0 }
}
export async function postComment(noteId: string, userId: string, body: string) {
  const { error } = await getClient().from('comments').insert({ note_id: noteId, author_id: userId, body })
  if (error) throw error
}
export async function deleteComment(commentId: string) {
  const { error } = await getClient().from('comments').delete().eq('id', commentId)
  if (error) throw error
}
