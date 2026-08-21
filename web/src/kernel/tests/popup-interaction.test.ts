/* @vitest-environment jsdom */
/* Kernel conformance for `popup-interaction`.
 *
 * The first block is `reference-components/src/kernel/js/tests/popup-interaction.unit.test.ts`
 * ADAPTED UNCHANGED — every assertion is the reference's, only the import path
 * differs. That file is black-box by its own contract (`popup-interaction.md`:
 * "Black-box: tests/popup-interaction.unit.test.ts covers the nextTabStop
 * wrapping/wrap-around/snap logic").
 *
 * The `[ADDED]` blocks below cover `trapPopupInteraction` itself, which the
 * reference leaves entirely to the five field e2e suites. Since the five fields
 * are not ported yet, without these the wiring — the half that actually holds
 * focus inside an aria-modal dialog — would ship with zero executable coverage.
 * See findings/kernel.md.
 */
import { describe, it, expect } from 'vitest'
import { nextTabStop } from '../popup-interaction'

// Build a tab-stop list of plain divs (jsdom). Only identity + indexOf matter.
function stops(n: number): HTMLElement[] {
  return Array.from({ length: n }, () => document.createElement('div'))
}

describe('nextTabStop', () => {
  it('moves forward one stop', () => {
    const s = stops(4)
    expect(nextTabStop(s, s[0], false)).toBe(s[1])
    expect(nextTabStop(s, s[2], false)).toBe(s[3])
  })

  it('moves backward one stop', () => {
    const s = stops(4)
    expect(nextTabStop(s, s[3], true)).toBe(s[2])
    expect(nextTabStop(s, s[1], true)).toBe(s[0])
  })

  it('wraps last → first on forward Tab', () => {
    const s = stops(3)
    expect(nextTabStop(s, s[2], false)).toBe(s[0])
  })

  it('wraps first → last on Shift+Tab (deliberate aria-modal behaviour)', () => {
    const s = stops(3)
    expect(nextTabStop(s, s[0], true)).toBe(s[2])
  })

  it('snaps to first when focus is on a non-stop element (forward)', () => {
    const s = stops(3)
    const stray = document.createElement('button')
    expect(nextTabStop(s, stray, false)).toBe(s[0])
  })

  it('snaps to last when focus is on a non-stop element (backward)', () => {
    const s = stops(3)
    const stray = document.createElement('button')
    expect(nextTabStop(s, stray, true)).toBe(s[2])
  })

  it('snaps to an end when nothing is focused', () => {
    const s = stops(3)
    expect(nextTabStop(s, null, false)).toBe(s[0])
    expect(nextTabStop(s, null, true)).toBe(s[2])
  })

  it('returns null for an empty stop list', () => {
    expect(nextTabStop([], null, false)).toBeNull()
    expect(nextTabStop([], document.createElement('div'), true)).toBeNull()
  })

  it('a single stop wraps onto itself in both directions', () => {
    const s = stops(1)
    expect(nextTabStop(s, s[0], false)).toBe(s[0])
    expect(nextTabStop(s, s[0], true)).toBe(s[0])
  })
})

/* ── [ADDED] trapPopupInteraction — the wiring the reference defers to e2e ──── */

import { beforeEach, afterEach } from 'vitest'
import { trapPopupInteraction } from '../popup-interaction'

let controller: AbortController

function popup(stopCount: number): { container: HTMLElement; stops: HTMLElement[] } {
  const container = document.createElement('div')
  container.setAttribute('role', 'dialog')
  container.setAttribute('aria-modal', 'true')
  const made: HTMLElement[] = []
  for (let i = 0; i < stopCount; i++) {
    const b = document.createElement('button')
    b.textContent = `stop-${i}`
    container.appendChild(b)
    made.push(b)
  }
  document.body.appendChild(container)
  return { container, stops: made }
}

function tab(container: HTMLElement, shiftKey = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  container.dispatchEvent(e)
  return e
}

beforeEach(() => {
  controller = new AbortController()
})

afterEach(() => {
  controller.abort()
  document.body.innerHTML = ''
})

describe('[ADDED] trapPopupInteraction — cyclic Tab trap', () => {
  it('moves focus forward and preventDefaults the Tab', () => {
    const { container, stops } = popup(3)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    stops[0].focus()
    const e = tab(container)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(stops[1])
  })

  it('wraps last → first rather than leaking to the page', () => {
    const { container, stops } = popup(3)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    stops[2].focus()
    tab(container)
    expect(document.activeElement).toBe(stops[0])
  })

  it('wraps first → last on Shift+Tab', () => {
    const { container, stops } = popup(3)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    stops[0].focus()
    tab(container, true)
    expect(document.activeElement).toBe(stops[2])
  })

  it('preventDefaults even with a single stop', () => {
    const { container, stops } = popup(1)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    stops[0].focus()
    const e = tab(container)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(stops[0])
  })

  it('re-reads tabStops() on every Tab (a stop removed between Tabs is skipped)', () => {
    const { container, stops } = popup(3)
    let live = stops
    trapPopupInteraction({ container, tabStops: () => live, signal: controller.signal })
    stops[0].focus()
    live = [stops[0], stops[2]] // Clear button disappeared
    tab(container)
    expect(document.activeElement).toBe(stops[2])
  })

  it('lets Tab leak when tabStops() is empty (the documented exception)', () => {
    const { container } = popup(0)
    trapPopupInteraction({ container, tabStops: () => [], signal: controller.signal })
    const e = tab(container)
    expect(e.defaultPrevented).toBe(false)
  })

  it('ignores keys other than Tab, so Escape and arrows stay per-component', () => {
    const { container, stops } = popup(3)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    stops[0].focus()
    for (const key of ['Escape', 'ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      container.dispatchEvent(e)
      expect(e.defaultPrevented).toBe(false)
    }
    expect(document.activeElement).toBe(stops[0])
  })

  it('snaps back inside when focus sat outside the popup', () => {
    const { container, stops } = popup(3)
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    outside.focus()
    tab(container)
    expect(document.activeElement).toBe(stops[0])
  })
})

describe('[ADDED] trapPopupInteraction — scroll containment', () => {
  it('preventDefaults a wheel event on the popup surface', () => {
    const { container, stops } = popup(2)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    const e = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    container.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it('preventDefaults a wheel event that bubbles up from inside a gap', () => {
    const { container, stops } = popup(2)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    const e = new WheelEvent('wheel', { deltaY: -40, bubbles: true, cancelable: true })
    stops[1].dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it('does not touch a wheel event outside the popup', () => {
    const { container, stops } = popup(2)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    const e = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    outside.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
  })
})

describe('[ADDED] trapPopupInteraction — teardown', () => {
  it('removes both listeners when the signal aborts (popup close)', () => {
    const { container, stops } = popup(3)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    controller.abort()
    stops[0].focus()
    const k = tab(container)
    expect(k.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(stops[0])
    const w = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    container.dispatchEvent(w)
    expect(w.defaultPrevented).toBe(false)
  })

  // NOT ASSERTED HERE: "installs nothing when handed an already-aborted
  // signal". Per DOM spec, `addEventListener` returns early if the signal is
  // already aborted, and Chromium 147 does exactly that
  // (web/tasks/probes/aborted-signal.cjs: 0 firings) — but under vitest's jsdom
  // environment the global `AbortController` is **Node's**, not jsdom's
  // (`signal instanceof EventTarget === false`), so jsdom's addEventListener
  // does not recognise its aborted flag and registers the listener anyway.
  // Abort-AFTER-install works in both (the test above). Asserting the
  // pre-aborted case would encode a test-environment bug as a contract, so it
  // is recorded in findings/kernel.md instead.

  it('StrictMode double-invocation is safe when each install owns its controller', () => {
    // React 19 StrictMode runs an effect, cleans it up, and runs it again. As
    // long as the AbortController is created inside the effect and aborted in
    // the cleanup, the first install is gone before the second lands — one Tab
    // moves focus exactly one stop, not two.
    const { container, stops } = popup(4)
    const first = new AbortController()
    trapPopupInteraction({ container, tabStops: () => stops, signal: first.signal })
    first.abort() // StrictMode cleanup
    const second = new AbortController()
    trapPopupInteraction({ container, tabStops: () => stops, signal: second.signal })
    stops[0].focus()
    tab(container)
    expect(document.activeElement).toBe(stops[1])
    second.abort()
  })

  it('a REUSED controller across two installs double-advances focus (the trap to avoid)', () => {
    // The failure mode the comment in popup-interaction.ts warns about: install
    // twice on one signal and each Tab fires both handlers, skipping a stop.
    const { container, stops } = popup(4)
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    trapPopupInteraction({ container, tabStops: () => stops, signal: controller.signal })
    stops[0].focus()
    tab(container)
    expect(document.activeElement).toBe(stops[2])
  })
})
