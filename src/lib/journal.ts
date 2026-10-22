import type { Mood, Visibility } from './database'

export const moods: Mood[] = ['reflective', 'heavy', 'hopeful', 'peaceful', 'unsettled']
export const PAGE_SIZE = 24
export const LEGACY_KEY = 'the-unsaid-fragments-v1'
export type Scope = 'journal' | 'community'
export type ViewMode = 'fragments' | 'timeline' | 'calendar'
export type Filters = { search: string; mood: Mood | ''; visibility: Visibility | ''; images: boolean; saved: boolean; sort: 'newest' | 'oldest' | 'updated'; from: string; to: string }
export const defaultFilters: Filters = { search: '', mood: '', visibility: '', images: false, saved: false, sort: 'newest', from: '', to: '' }

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function displayDate(date: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}
export function monthBounds(date: Date) {
  return { from: localDate(new Date(date.getFullYear(), date.getMonth(), 1)), to: localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)) }
}
export function calendarDays(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const offset = (start.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), 1 - offset + index))
}
export function validateImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP, or GIF image.')
  if (file.size > 2 * 1024 * 1024) throw new Error('Choose an image smaller than 2 MB.')
}
export function validateImageUrl(value: string) {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error('Enter a complete HTTPS image URL.') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Use an HTTPS image URL without embedded credentials.')
  return parsed.href
}
export function escapeSearch(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}
export type LegacyNote = { id: string; text: string; date: string; image?: string; saved: boolean }
export function parseLegacy(raw: string): LegacyNote[] {
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || !value.every((note): note is LegacyNote =>
    typeof note === 'object' && note !== null && typeof note.id === 'string' &&
    typeof note.text === 'string' && note.text.length <= 10000 &&
    typeof note.date === 'string' && Number.isFinite(Date.parse(note.date)) &&
    typeof note.saved === 'boolean' && (note.image === undefined || typeof note.image === 'string')
  )) throw new Error('The browser journal is not in a supported format. Its original data has not been changed.')
  return value
}
