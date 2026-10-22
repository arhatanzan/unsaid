import { describe, expect, it } from 'vitest'
import { calendarDays, escapeSearch, localDate, monthBounds, parseLegacy, validateImage, validateImageUrl } from './journal'

describe('journal dates', () => {
  it('uses local date components, not UTC conversion', () => {
    expect(localDate(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22')
  })
  it('finds leap-year month bounds', () => {
    expect(monthBounds(new Date(2028, 1, 20))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
  it('renders six Monday-first calendar weeks across year boundaries', () => {
    const days = calendarDays(new Date(2027, 0, 1))
    expect(days).toHaveLength(42)
    expect(days[0].getDay()).toBe(1)
    expect(localDate(days[0])).toBe('2026-12-28')
    expect(days.filter(day => day.getMonth() === 0)).toHaveLength(31)
  })
})
describe('images and imports', () => {
  it('allows HTTPS image URLs without credentials only', () => {
    expect(validateImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg')
    for (const url of ['javascript:alert(1)', 'data:image/png,hello', 'http://example.com/x', 'https://user:pass@example.com/x', 'invalid']) {
      expect(() => validateImageUrl(url)).toThrow()
    }
  })
  it('enforces MIME types and the exact 2 MB limit', () => {
    expect(() => validateImage(new File([new Uint8Array(2 * 1024 * 1024)], 'x.png', { type: 'image/png' }))).not.toThrow()
    expect(() => validateImage(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'x.png', { type: 'image/png' }))).toThrow('smaller than 2 MB')
    expect(() => validateImage(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))).toThrow('JPG')
  })
  it('accepts valid legacy fragments and rejects corrupt data', () => {
    expect(parseLegacy('[{"id":"one","text":"A page","date":"2026-10-22","saved":false}]')).toHaveLength(1)
    for (const raw of ['{}', '[null]', '[{"id":"x","text":"test","date":"bad","saved":false}]']) expect(() => parseLegacy(raw)).toThrow()
  })
  it('treats search wildcards as literal characters', () => {
    expect(escapeSearch('100%_done\\')).toBe('100\\%\\_done\\\\')
  })
})
