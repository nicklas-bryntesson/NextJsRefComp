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
 * suite does not exercise, plus a regression for the cross-column wheel-lock
 * leak fixed in our port. See findings/kernel.md.
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

  it('[PORT FIX] releases the lock on destroy, so the next popup still scrolls', () => {
    // Reference behaviour: destroy() clears _wheelTimer, so the snap and hence
    // _commit never run, and _activeWheelCol stays pointing at the dead
    // instance — every wheel column in the app then ignores trackpad scroll for
    // the rest of the page's life. Our destroy() releases the lock.
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
  it('unbinds click as well as wheel', () => {
    const { el, wheel, onChange } = makeWheel({ value: 0, format: v => String(v) })
    wheel.destroy()
    const opt = el.querySelector<HTMLElement>('.option[data-value="1"]')!
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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
