/* @vitest-environment jsdom */
/* Conformance for the promoted `css-px` kernel helper.
 *
 * There is no reference test to adapt — the reference duplicates this probe as a
 * private `_getCSSPx()` in six components and never tests it directly. These
 * cases pin the MECHANICS, which is what a consumer can break: probe appended
 * inside the host (custom-property inheritance), measured, and removed again
 * with nothing left behind, even when measurement throws.
 *
 * jsdom has no layout engine, so `getBoundingClientRect()` always reports 0 —
 * the actual px resolution of `calc()` / `rem` / `var()` chains is verified in
 * Chromium by `web/tasks/probes/css-px-browser.cjs`, whose output is quoted in
 * findings/kernel.md.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveCssPx } from '../css-px'

let host: HTMLElement

beforeEach(() => {
  document.body.innerHTML = ''
  host = document.createElement('div')
  document.body.appendChild(host)
})

describe('resolveCssPx — probe mechanics', () => {
  it('leaves the host with no children afterwards', () => {
    resolveCssPx(host, '--anything')
    expect(host.children).toHaveLength(0)
    expect(host.innerHTML).toBe('')
  })

  it('appends the probe INSIDE the host, not to the body', () => {
    // Custom properties inherit, so a component-scoped or variant override is
    // only visible from inside the component root. Measuring from <body> would
    // silently read the wrong cascade.
    let parentAtMeasureTime: Node | null = null
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        parentAtMeasureTime = this.parentNode
        return { width: 12, height: 0, top: 0, left: 0, right: 12, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
      })
    const px = resolveCssPx(host, '--x')
    spy.mockRestore()
    expect(parentAtMeasureTime).toBe(host)
    expect(px).toBe(12)
  })

  it('substitutes the property name into a width, with a 0px fallback', () => {
    let css = ''
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        css = this.style.cssText
        return { width: 0 } as DOMRect
      })
    resolveCssPx(host, '--_tt-arrow-size')
    spy.mockRestore()
    expect(css).toContain('width: var(--_tt-arrow-size,0px)')
  })

  it('keeps the probe out of layout and out of the a11y tree while it exists', () => {
    let css = ''
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        css = this.style.cssText
        return { width: 0 } as DOMRect
      })
    resolveCssPx(host, '--x')
    spy.mockRestore()
    expect(css).toContain('position: absolute')
    expect(css).toContain('visibility: hidden')
    expect(css).toContain('pointer-events: none')
  })

  it('does not disturb existing children', () => {
    const kid = document.createElement('span')
    kid.textContent = 'keep me'
    host.appendChild(kid)
    resolveCssPx(host, '--x')
    expect(host.children).toHaveLength(1)
    expect(host.firstElementChild).toBe(kid)
  })

  it('returns 0 in an environment with no layout engine rather than NaN', () => {
    expect(resolveCssPx(host, '--unset-property')).toBe(0)
  })

  it('creates the probe in the host\'s own document', () => {
    const other = document.implementation.createHTMLDocument('other')
    const otherHost = other.createElement('div')
    other.body.appendChild(otherHost)
    expect(() => resolveCssPx(otherHost, '--x')).not.toThrow()
    expect(otherHost.children).toHaveLength(0)
  })

  it('is callable repeatedly without accumulating nodes', () => {
    for (let i = 0; i < 20; i++) resolveCssPx(host, '--x')
    expect(host.children).toHaveLength(0)
  })
})
