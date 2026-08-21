/* @vitest-environment jsdom */
/* Kernel conformance for `locale`.
 *
 * WRITTEN FROM THE CONTRACT, not adapted: the reference ships **no** unit test
 * for this module. `src/kernel/README.md` lists its conformance as "(covered via
 * component tests)" and `locale.md`'s Conformance section says the same. So the
 * only executable statement of this module's behaviour before this file was the
 * two `@example` lines in the doc comment. Every case below is derived from
 * `locale.md`'s "Public API" + "Semantics" sections.
 *
 * jsdom is required because `readLocale` reads `data-locale` and `<html lang>`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readLocale, resolveLocale } from '../locale'

beforeEach(() => {
  document.documentElement.removeAttribute('lang')
  document.body.innerHTML = ''
})

function el(attrs: Record<string, string> = {}): HTMLElement {
  const div = document.createElement('div')
  for (const [k, v] of Object.entries(attrs)) div.setAttribute(k, v)
  document.body.appendChild(div)
  return div
}

describe('readLocale — data-locale → <html lang> → fallback', () => {
  it('prefers data-locale over <html lang>', () => {
    document.documentElement.lang = 'de-DE'
    expect(readLocale(el({ 'data-locale': 'sv-SE' }))).toBe('sv-SE')
  })

  it('falls back to <html lang> when data-locale is absent', () => {
    document.documentElement.lang = 'sv-SE'
    expect(readLocale(el())).toBe('sv-SE')
  })

  it('falls back to <html lang> when data-locale is present but empty', () => {
    // An empty attribute is falsy through `dataset`, so it does not shadow the
    // page language. Worth pinning: an implementation using
    // `hasAttribute('data-locale')` would return '' here instead.
    document.documentElement.lang = 'sv-SE'
    expect(readLocale(el({ 'data-locale': '' }))).toBe('sv-SE')
  })

  it('falls back to "en" by default when neither is set', () => {
    expect(readLocale(el())).toBe('en')
  })

  it('honours an explicit fallback argument', () => {
    expect(readLocale(el(), 'sv')).toBe('sv')
  })

  it('does not require the element to be attached to the document', () => {
    document.documentElement.lang = 'sv-SE'
    const detached = document.createElement('div')
    detached.dataset.locale = 'fr-FR'
    expect(readLocale(detached)).toBe('fr-FR')
  })

  it('reads the page language of the element\'s OWN document', () => {
    // The reference reads the module-global `document`; this port reads
    // `el.ownerDocument`. Identical for a single-document page, and correct for
    // an element created in another document (a portal target, an iframe).
    document.documentElement.lang = 'de-DE'
    expect(readLocale(el())).toBe('de-DE')
    const other = document.implementation.createHTMLDocument('other')
    other.documentElement.lang = 'ja-JP'
    expect(readLocale(other.createElement('div'))).toBe('ja-JP')
  })
})

describe('resolveLocale — exact → base language → fallback', () => {
  const available = { en: {}, sv: {} }

  it('returns an exact match', () => {
    expect(resolveLocale('sv', available)).toBe('sv')
  })

  it('degrades a region tag to its base language ("sv-SE" → "sv")', () => {
    expect(resolveLocale('sv-SE', available)).toBe('sv')
  })

  it('prefers an exact region match over the base language', () => {
    expect(resolveLocale('sv-SE', { en: {}, sv: {}, 'sv-SE': {} })).toBe('sv-SE')
  })

  it('falls back when neither the tag nor its base is available ("fr" → "en")', () => {
    expect(resolveLocale('fr', available)).toBe('en')
  })

  it('falls back when the base language is also unavailable ("fr-CA" → "en")', () => {
    expect(resolveLocale('fr-CA', available)).toBe('en')
  })

  it('honours an explicit fallback argument', () => {
    expect(resolveLocale('fr', available, 'sv')).toBe('sv')
  })

  it('falls back for an empty requested locale', () => {
    expect(resolveLocale('', available)).toBe('en')
  })

  it('handles a three-part tag by taking the first subtag', () => {
    expect(resolveLocale('zh-Hans-CN', { en: {}, zh: {} })).toBe('zh')
  })

  it('is case-sensitive — "SV" does not find "sv"', () => {
    // Documented consequence of plain object indexing. BCP 47 tags are
    // case-insensitive in principle, so a component that forwards a
    // user-authored `data-locale="SV"` gets the fallback, not Swedish.
    expect(resolveLocale('SV', available)).toBe('en')
  })

  it('treats a key with a falsy value as absent', () => {
    // The check is truthiness of `available[requested]`, not `in`. A translation
    // table holding an empty string or 0 for a locale resolves to the fallback.
    expect(resolveLocale('sv', { en: {}, sv: '' })).toBe('en')
  })

  it('composes with readLocale end-to-end', () => {
    document.documentElement.lang = 'sv-SE'
    expect(resolveLocale(readLocale(el()), available)).toBe('sv')
  })
})
