/* @vitest-environment jsdom */
/* Kernel conformance for `WheelColumn`, adapted from
 * `reference-components/src/kernel/js/tests/WheelColumn.unit.test.ts`.
 *
 * PORTABILITY: the reference file is black-box — it constructs the primitive
 * through its documented constructor and asserts only DOM/ARIA and public-API
 * results. Two mechanical changes were needed and nothing else:
 *   1. the import path;
 *   2. the docblock above, because vitest.config.mts uses `environment: 'node'`
 *      for the pure kernel modules and this one needs a DOM.
 * No assertion was rewritten, weakened or dropped.
 *
 * `[ADDED]` blocks below cover claims WheelColumn.md makes that the reference
 * suite does not exercise. See findings/kernel.md.
 *
 * Upstream `52356b8` added four describe blocks of its own — the module-level
 * wheel lock across a mid-scroll teardown, tapping an option through the
 * pointer flow, and the spinbutton's published value. They are ported below
 * under their upstream names; our own cross-column lock block predates them and
 * is kept because it asserts the min-delta inertia gate, which upstream does
 * not.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import WheelColumn, { type WheelColumnOptions } from '../WheelColumn'

// Kernel conformance tests for the WheelColumn DOM primitive. These exercise the
// public API + the drift-prone maths (loop wrap, bounded clamp, onChange gating,
// format, ARIA). The interactive physics (drag/momentum/snap) is covered by the
// component e2e suites. We mock prefers-reduced-motion: reduce so animations
// short-circuit synchronously — no requestAnimationFrame needed. The animated
// setValue regression instead allows motion and drives a stubbed rAF queue.

function makeWheel(opts: Partial<WheelColumnOptions> = {}): {
  el: HTMLElement
  wheel: WheelColumn
  onChange: ReturnType<typeof vi.fn>
} {
  const el = document.createElement('div')
  el.className = 'Wheel'
  el.id = 'test-wheel'
  document.body.appendChild(el)
  const onChange = vi.fn()
  const wheel = new WheelColumn(el, { min: 0, max: 11, value: 0, onChange, ...opts })
  return { el, wheel, onChange }
}

/* jsdom implements no pointer capture; the handlers only need it not to throw. */
function stubPointerCapture(el: HTMLElement): void {
  ;(el as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
  ;(el as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {}
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('WheelColumn — construction & ARIA', () => {
  it('marks the host as a spinbutton with min/max', () => {
    const { el } = makeWheel({ min: 0, max: 11 })
    expect(el.getAttribute('role')).toBe('spinbutton')
    expect(el.getAttribute('aria-valuemin')).toBe('0')
    expect(el.getAttribute('aria-valuemax')).toBe('11')
  })

  it('sets tabindex="0" when the host has none', () => {
    const { el } = makeWheel()
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('reflects the initial value in aria-valuenow + aria-valuetext (default zero-pad)', () => {
    const { el } = makeWheel({ value: 5 })
    expect(el.getAttribute('aria-valuenow')).toBe('5')
    expect(el.getAttribute('aria-valuetext')).toBe('05')
  })

  it('renders no aria-valuenow and aria-valuetext "--" when value is null', () => {
    const { el } = makeWheel({ value: null })
    expect(el.hasAttribute('aria-valuenow')).toBe(false)
    expect(el.getAttribute('aria-valuetext')).toBe('--')
  })

  it('sets aria-activedescendant to the centred option', () => {
    const { el } = makeWheel()
    expect(el.getAttribute('aria-activedescendant')).toBe('test-wheel-front')
  })

  it('does not fire onChange during construction', () => {
    const { onChange } = makeWheel({ value: 5 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes count as max - min + 1', () => {
    const { wheel } = makeWheel({ min: 0, max: 11 })
    expect(wheel.count).toBe(12)
  })
})

describe('WheelColumn — looping (default)', () => {
  it('wraps past the max back to min (Dec → Jan)', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 11 })
    wheel.stepBy(1)
    expect(wheel.value).toBe(0)
  })

  it('wraps past the min back to max (Jan → Dec)', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    wheel.stepBy(-1)
    expect(wheel.value).toBe(11)
  })
})

describe('WheelColumn — bounded (loop: false)', () => {
  it('clamps at the max instead of wrapping', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 11, loop: false })
    wheel.stepBy(1)
    expect(wheel.value).toBe(11)
  })

  it('clamps at the min instead of wrapping', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 0, loop: false })
    wheel.stepBy(-1)
    expect(wheel.value).toBe(0)
  })
})

describe('WheelColumn — onChange gating', () => {
  it('fires onChange with the new value on stepBy', () => {
    const { wheel, onChange } = makeWheel({ value: 5 })
    wheel.stepBy(1)
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('does NOT fire onChange on setValue (external sync)', () => {
    const { wheel, onChange } = makeWheel({ value: 5 })
    wheel.setValue(8)
    expect(onChange).not.toHaveBeenCalled()
    expect(wheel.value).toBe(8)
  })

  it('does NOT fire onChange on animated setValue (motion allowed), and later user steps still do', () => {
    // Motion allowed: the eased snap defers _commit to rAF frames — the
    // _externalSet flag must survive until that deferred commit.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
    let frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    // Drain the rAF queue with large timesteps so the eased snap lands fast.
    const drive = (): void => {
      let t = performance.now()
      for (let i = 0; i < 50 && frames.length > 0; i++) {
        const batch = frames
        frames = []
        t += 100
        for (const cb of batch) cb(t)
      }
      expect(frames.length).toBe(0)
    }

    const { wheel, onChange } = makeWheel({ value: 5 })

    wheel.setValue(8)
    drive()
    expect(onChange).not.toHaveBeenCalled()
    expect(wheel.value).toBe(8)

    wheel.stepBy(1)
    drive()
    expect(onChange).toHaveBeenCalledWith(9)
  })
})

describe('WheelColumn — format', () => {
  it('uses a custom format for the centred value (aria-valuetext)', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const { el } = makeWheel({ value: 2, format: v => months[v] })
    expect(el.getAttribute('aria-valuetext')).toBe('Mar')
  })
})

describe('WheelColumn — setValue', () => {
  it('updates the value getter', () => {
    const { wheel } = makeWheel({ value: 3 })
    wheel.setValue(7)
    expect(wheel.value).toBe(7)
  })

  it('reflects the new value in aria-valuenow', () => {
    const { el, wheel } = makeWheel({ value: 3 })
    wheel.setValue(7)
    expect(el.getAttribute('aria-valuenow')).toBe('7')
  })

  it('clears to an empty state on setValue(null)', () => {
    const { el, wheel } = makeWheel({ value: 3 })
    wheel.setValue(null)
    expect(wheel.value).toBeNull()
    expect(el.hasAttribute('aria-valuenow')).toBe(false)
    expect(el.getAttribute('aria-valuetext')).toBe('--')
  })
})

describe('WheelColumn — destroy', () => {
  it('stops responding to input after destroy', () => {
    const { el, wheel, onChange } = makeWheel({ value: 5 })
    wheel.destroy()
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }))
    expect(onChange).not.toHaveBeenCalled()
    expect(wheel.value).toBe(5)
  })
})

/* ── [ADDED] claims from WheelColumn.md / Wheel.md the reference suite omits ── */

describe('[ADDED] WheelColumn — injected DOM contract', () => {
  it('injects one .ring with nine .option slots, and a .band as the ring\'s sibling', () => {
    const { el } = makeWheel()
    const ring = el.querySelector('.ring')
    expect(ring).not.toBeNull()
    expect(ring!.querySelectorAll('.option')).toHaveLength(9) // HALF=4 → -4…+4
    const band = el.querySelector('.band')
    expect(band).not.toBeNull()
    expect(band!.parentElement).toBe(el)      // sibling of the ring, not inside it
    expect(el.children.length).toBe(2)
  })

  it('marks every option aria-hidden (the host spinbutton carries the value)', () => {
    const { el } = makeWheel()
    el.querySelectorAll('.option').forEach(o =>
      expect(o.getAttribute('aria-hidden')).toBe('true'),
    )
  })

  it('points aria-activedescendant at an option that actually exists', () => {
    const { el } = makeWheel({ value: 4 })
    const id = el.getAttribute('aria-activedescendant')!
    expect(el.querySelector(`#${id}`)).not.toBeNull()
    expect(el.querySelector(`#${id}`)!.getAttribute('aria-selected')).toBe('true')
  })

  it('respects an authored tabindex instead of forcing 0', () => {
    // WheelColumn.md: "Give it a tabindex if you want it focusable before
    // construction (otherwise WheelColumn sets tabindex='0')". A component using
    // roving tabindex authors -1 on the non-active columns.
    const el = document.createElement('div')
    el.className = 'Wheel'
    el.setAttribute('tabindex', '-1')
    document.body.appendChild(el)
    const w = new WheelColumn(el, { min: 0, max: 11, value: 0, onChange: () => {} })
    expect(el.getAttribute('tabindex')).toBe('-1')
    w.destroy()
  })

  it('sets aria-selected="false" on the off-centre options', () => {
    // Doc/impl mismatch worth pinning: WheelColumn.md says only "the centred one
    // gets aria-selected='true' + an id", implying the others carry nothing. The
    // implementation writes an explicit "false" on all eight others.
    const { el } = makeWheel()
    const opts = [...el.querySelectorAll('.option')]
    expect(opts.filter(o => o.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    expect(opts.filter(o => o.getAttribute('aria-selected') === 'false')).toHaveLength(8)
  })
})

describe('[ADDED] WheelColumn — rendered rows', () => {
  it('renders the wrapped neighbour on a looping wheel (Jan shows Dec above it)', () => {
    const { el } = makeWheel({ min: 0, max: 11, value: 0, format: v => String(v) })
    const values = [...el.querySelectorAll<HTMLElement>('.option')].map(o => o.dataset.value)
    // slots run o = -4 … +4; the centred slot (index 4) is 0, so index 3 wraps to 11
    expect(values[4]).toBe('0')
    expect(values[3]).toBe('11')
    expect(values[5]).toBe('1')
  })

  it('renders nothing past the ends on a bounded wheel', () => {
    const { el } = makeWheel({ min: 0, max: 11, value: 0, loop: false })
    const opts = [...el.querySelectorAll<HTMLElement>('.option')]
    // slots -4…-1 are before the start → blank, no data-value, no aria-selected
    for (const o of opts.slice(0, 4)) {
      expect(o.textContent).toBe('')
      expect(o.dataset.value).toBeUndefined()
      expect(o.hasAttribute('aria-selected')).toBe(false)
    }
    expect(opts[4].dataset.value).toBe('0')
  })

  it('applies a custom format to the option text, not just aria-valuetext', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const { el } = makeWheel({ value: 2, format: v => months[v] })
    const centre = el.querySelector<HTMLElement>('.option[aria-selected="true"]')!
    expect(centre.textContent).toBe('Mar')
  })

  it('falls back to a 38px row height when Wheel.css is absent (jsdom resolves no custom properties)', () => {
    // Wheel.md: "--_wheel-row-height (default 38px) — read back by
    // WheelColumn.ts (readRowHeight) to size the geometry." The documented
    // fallback is what keeps a CSS-less environment from dividing by zero.
    const { el } = makeWheel()
    const radius = 19 / Math.tan((10 * Math.PI) / 180) // rowH/2 / tan(STEP_DEG/2)
    const ring = el.querySelector<HTMLElement>('.ring')!
    const z = Number(/translateZ\((-?[\d.]+)px\)/.exec(ring.style.transform)![1])
    expect(z).toBeCloseTo(-radius, 2)
    expect(radius).toBeCloseTo(107.75, 1)
  })
})

describe('[ADDED] WheelColumn — non-zero min and multi-step', () => {
  it('maps values through min (a 1–31 day column)', () => {
    const { el, wheel } = makeWheel({ min: 1, max: 31, value: 1 })
    expect(wheel.count).toBe(31)
    expect(el.getAttribute('aria-valuemin')).toBe('1')
    expect(el.getAttribute('aria-valuemax')).toBe('31')
    wheel.stepBy(-1)
    expect(wheel.value).toBe(31) // wraps to the last day, not to 0
  })

  it('wraps a multi-row step (stepBy(13) on a 12-row wheel)', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    wheel.stepBy(13)
    expect(wheel.value).toBe(1)
  })

  it('clamps a multi-row step on a bounded wheel', () => {
    const { wheel } = makeWheel({ min: 0, max: 23, value: 20, loop: false })
    wheel.stepBy(10)
    expect(wheel.value).toBe(23)
  })
})

describe('[ADDED] WheelColumn — cross-column wheel lock', () => {
  // The lock is MODULE state, so it outlives any one popup. Both directions are
  // asserted: it must block a neighbour while a column is scrolling, and it must
  // not survive that column's destruction.
  function wheelEvent(deltaY: number): WheelEvent {
    return new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
  }

  it('blocks a neighbouring column while one column owns the lock', () => {
    const a = makeWheel({ value: 0 })
    const b = makeWheel({ value: 0 })
    a.el.dispatchEvent(wheelEvent(120))
    expect(a.wheel.pos).toBeCloseTo(-1, 5)
    b.el.dispatchEvent(wheelEvent(120))
    expect(b.wheel.pos).toBe(0) // ignored — a holds the lock
    a.wheel.destroy()
    b.wheel.destroy()
  })

  it('releases the lock on destroy, so the next popup still scrolls', () => {
    // Pre-52356b8 behaviour: destroy() clears _wheelTimer, so the snap and
    // hence _commit never run, and _activeWheelCol stays pointing at the dead
    // instance — every wheel column in the app then ignores trackpad scroll for
    // the rest of the page's life. Found by this port (F-030) and fixed
    // upstream independently; destroy() releases the lock.
    const a = makeWheel({ value: 0 })
    a.el.dispatchEvent(wheelEvent(120))
    a.wheel.destroy() // popup closed mid-scroll (Escape within 100 ms)

    const b = makeWheel({ value: 0 })
    b.el.dispatchEvent(wheelEvent(120))
    expect(b.wheel.pos).toBeCloseTo(-1, 5)
    b.wheel.destroy()
  })

  it('filters the inertia tail with a min-delta gate when no column holds the lock', () => {
    const a = makeWheel({ value: 0 })
    a.el.dispatchEvent(wheelEvent(4)) // < WHEEL_MIN_DELTA (15)
    expect(a.wheel.pos).toBe(0)
    a.wheel.destroy()
  })
})

describe('[ADDED] WheelColumn — destroy', () => {
  it('unbinds the tap gesture as well as wheel', () => {
    // Was 'unbinds click as well as wheel'. There is no click listener any more
    // (upstream 52356b8 — pointer capture retargets the compatibility mouse
    // events, so a click handler on .Wheel can never see an option). The claim
    // the test was making is still real, so it is driven through the pointer
    // flow that now carries taps.
    const { el, wheel, onChange } = makeWheel({ value: 0, format: v => String(v) })
    stubPointerCapture(el)
    wheel.destroy()
    const opt = el.querySelector<HTMLElement>('.option[data-value="1"]')!
    opt.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }))
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 100 }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is idempotent', () => {
    const { wheel } = makeWheel({ value: 3 })
    wheel.destroy()
    expect(() => wheel.destroy()).not.toThrow()
    expect(wheel.value).toBe(3)
  })

  it('leaves the injected DOM in place (React owns the host element, not us)', () => {
    // Relevant to a React consumer: destroy() must not remove nodes React did
    // not create it — it only aborts listeners. The host is unmounted by React.
    const { el, wheel } = makeWheel()
    wheel.destroy()
    expect(el.querySelector('.ring')).not.toBeNull()
  })
})

/* ── Ported from upstream 52356b8 ─────────────────────────────────────────────
 * Three defects behind one gesture surface. This port had independently found
 * and fixed only the first; the other two it never surfaced. Ported here
 * verbatim in intent — only the shared pointer-capture stub is factored out,
 * because this file already needed one.
 */

describe('WheelColumn — the module-level wheel lock', () => {
  // The lock lives at module scope so that trackpad inertia arriving on a
  // neighbouring column is ignored. That makes tearing a column down mid-scroll
  // a shared-state hazard: the owner is named globally, and the only release on
  // the happy path runs when the column snaps to rest.
  function scroll(el: HTMLElement, deltaY: number): void {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }))
  }

  it('lets a surviving column scroll after the owner is destroyed mid-scroll', () => {
    const a = makeWheel()
    const b = makeWheel()

    scroll(a.el, 120)           // a claims the lock; its snap timer has not fired
    expect(a.wheel.pos).not.toBe(0)

    a.wheel.destroy()           // popup closes while the trackpad still coasts

    const before = b.wheel.pos
    scroll(b.el, 120)
    expect(b.wheel.pos).not.toBe(before)

    b.wheel.destroy()
  })

  it('still ignores inertia bleeding onto a neighbour while the owner lives', () => {
    // The guard the fix must not weaken: an undestroyed owner keeps the lock.
    const a = makeWheel()
    const b = makeWheel()

    scroll(a.el, 120)
    const before = b.wheel.pos
    scroll(b.el, 120)
    expect(b.wheel.pos).toBe(before)

    a.wheel.destroy()
    b.wheel.destroy()
  })
})

describe('WheelColumn — tapping an option', () => {
  // Pointer capture retargets the compatibility mouse events, so `click` always
  // arrived with `.Wheel` as its target and tapping a number never selected it
  // with a real mouse. The tap is resolved in the pointer flow instead.
  function press(el: HTMLElement, target: Element, y: number): void {
    stubPointerCapture(el)
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: y }))
  }
  function release(el: HTMLElement, y: number, type = 'pointerup'): void {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY: y }))
  }

  function optionOtherThan(el: HTMLElement, value: number | null): HTMLElement {
    const options = [...el.querySelectorAll<HTMLElement>('.option')]
    const other = options.find(o => o.dataset.value && Number(o.dataset.value) !== value)
    if (!other) throw new Error('no other option rendered')
    return other
  }

  it('selects the option a stationary press landed on', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const option = optionOtherThan(el, wheel.value)
    const expected = Number(option.dataset.value)

    press(el, option, 100)
    release(el, 100)

    expect(wheel.value).toBe(expected)
    wheel.destroy()
  })

  it('does not select when the press was a drag', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const option = optionOtherThan(el, wheel.value)

    const pressed = Number(option.dataset.value)   // before the re-render
    press(el, option, 100)
    el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 40 }))
    release(el, 40)

    // Whatever the drag landed on, it is not "the option I pressed at y=100".
    expect(wheel.value).not.toBe(pressed)
    wheel.destroy()
  })

  it('does not select when the gesture is cancelled', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const before = wheel.value
    const option = optionOtherThan(el, before)

    press(el, option, 100)
    release(el, 100, 'pointercancel')

    expect(wheel.value).toBe(before)
    wheel.destroy()
  })

  it('ignores a press that landed outside any option', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const before = wheel.value

    press(el, el, 100)
    release(el, 100)

    expect(wheel.value).toBe(before)
    wheel.destroy()
  })
})

describe('WheelColumn — the spinbutton cannot lag its own value', () => {
  // render() publishes aria-valuenow / aria-valuetext out of the committed
  // value, so it has to run AFTER the commit. Rendering first published the
  // previous value every time the wheel came to rest: absent on the first
  // gesture from an empty column, one step behind from then on. The wheel moved
  // and the host field updated, so only the accessible value was wrong —
  // invisible on screen, which is why it survived to the port.
  //
  // This has to be driven through a gesture. setValue() assigns the value
  // before rendering on its own, so it cannot see the defect.
  function tap(el: HTMLElement, target: Element): void {
    stubPointerCapture(el)
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }))
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 100 }))
  }

  it('publishes a value after the first gesture on an empty column', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: null })
    expect(el.hasAttribute('aria-valuenow')).toBe(false)

    const option = [...el.querySelectorAll<HTMLElement>('.option')].find(o => o.dataset.value)!
    // Read it now: the slots are recycled, so this element carries a different
    // value once the gesture has re-rendered the column.
    const expected = option.dataset.value
    tap(el, option)

    expect(el.getAttribute('aria-valuenow')).toBe(expected)
    expect(el.getAttribute('aria-valuetext')).not.toBe('--')
    wheel.destroy()
  })

  it('agrees with its own value after a gesture, not with the one before', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const options = [...el.querySelectorAll<HTMLElement>('.option')].filter(o => o.dataset.value)
    for (const option of options.slice(0, 3)) {
      tap(el, option)
      expect(el.getAttribute('aria-valuenow')).toBe(String(wheel.value))
    }
    wheel.destroy()
  })
})
