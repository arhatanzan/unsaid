// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
function color(selector: string, property: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`Missing rule: ${selector}`)
  const block = css.slice(start, css.indexOf('}', start))
  const match = block.match(new RegExp(`${property}:\\s*(#[a-f\\d]{6}|var\\(--[\\w-]+\\))`, 'i'))
  if (!match) throw new Error(`Missing ${property} for ${selector}`)
  if (match[1].startsWith('#')) return match[1]
  const variable = match[1].slice(4, -1)
  const value = css.match(new RegExp(`${variable}:\\s*(#[a-f\\d]{6})`, 'i'))
  if (!value) throw new Error(`Missing variable: ${variable}`)
  return value[1]
}
function luminance(hex: string) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + .05) / (dark + .05)
}
it('keeps key normal-size text/background pairs above WCAG AA 4.5:1', () => {
  const pairs = [
    [color(':root', 'color'), color(':root', 'background')],
    [color('.intro-copy', 'color'), color(':root', 'background')],
    [color('.fragment', 'color'), color('.fragment', 'background')],
    [color('.fragment-meta', 'color'), color('.fragment', 'background')],
    [color('.note-action', 'color'), '#dde0d3'],
    [color('.note-attribution', 'color'), '#e0dcd4'],
    [color('.attachment-button', 'color'), color('.writing-section', 'background')],
    [color('.date-label', 'color'), color('.writing-section', 'background')],
    [color('.submit-button, .primary-button', 'color'), color('.submit-button, .primary-button', 'background')],
    [color('.search-field input', 'color'), color('.search-field input', 'background')],
    [color('.calendar-day', 'color'), color('.calendar-day', 'background')],
    [color('.journal-dialog .inline-error', 'color'), color('.journal-dialog', 'background')],
  ]
  for (const [foreground, background] of pairs) expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
})
