/* Kernel primitive — ported from
 * `reference-components/src/kernel/js/WheelColumn.ts`
 * (contract: `js/WheelColumn.md`, CSS pair: `css/Wheel.md`).
 *
 * PLAIN, FRAMEWORK-AGNOSTIC MODULE, AND DELIBERATELY STILL A CLASS.
 * CLAUDE.md's "port the logic, not the class" is a rule about *components* —
 * their state belongs in React. This is a kernel DOM primitive whose published
 * contract (`WheelColumn.md` → "Public API") IS the class:
 * `new WheelColumn(el, opts)` plus `setValue` / `stepBy` / `value` / `count` /
 * `render` / `destroy`. Four components compose it. Rewriting it as a hook
 * would (a) fork the shared behaviour the kernel exists to protect, and (b) put
 * a 60 fps rAF physics loop that mutates ~9 DOM nodes per frame through React
 * state, which is exactly the work React should not be doing. The consuming
 * component owns a `useRef<WheelColumn>` and an effect that constructs it and
 * calls `destroy()` in the cleanup.
 *
 * PAIRS WITH `Wheel.css`. `readRowHeight` reads `--_wheel-row-height` off the
 * host's computed style (falling back to 38px), so the stylesheet — copied
 * byte-identically to `src/kernel/Wheel.css` — must be in the page. Ship the JS
 * without the CSS and the options stack as unstyled overlapping text *and* fail
 * colour contrast; `Wheel.md` records that as the original port's
 * hardest-to-find bug, caught only by axe. This module does NOT import the CSS:
 * the five popup components import `../../kernel/Wheel.css` themselves, the
 * same way each component imports its own stylesheet, so the CSS stays out of
 * any bundle that only needs the maths.
 *
 * SSR: safe to import, never safe to construct on the server. Nothing runs at
 * module scope except two consts and the cross-column lock; `getComputedStyle`,
 * `document.createElement`, `performance.now` and `window.matchMedia` are all
 * reached from the constructor or a handler. Construct it inside an effect.
 *
 * Conformance: `src/kernel/tests/WheelColumn.test.ts`, adapted from
 * `reference-components/src/kernel/js/tests/WheelColumn.unit.test.ts`.
 *
 * ONE BEHAVIOURAL DEVIATION from the reference, marked [PORT FIX] below:
 * `destroy()` releases the module-level cross-column wheel lock. See
 * findings/kernel.md — without it, closing the popup mid-scroll strands the
 * lock on a destroyed instance and every wheel column in the app stops
 * responding to trackpad scroll for the rest of the page's life.
 */

export interface WheelColumnOptions {
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
  /** Declared by the contract, not yet consumed by the reference either. */
  disabled?: (value: number) => boolean;
  /** When false, the wheel stops at min/max instead of wrapping. Default: true (loops). */
  loop?: boolean;
  /** Render a value as display text (e.g. month names). Default: zero-padded number. */
  format?: (value: number) => string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const STEP_DEG = 20;
const HALF = 4;
const MAX_V = 21;
const SNAP_THRESHOLD = 4.5;
const STALE_IDLE_MS = 70;
const WHEEL_SNAP_DELAY_MS = 100;

// Prevents trackpad inertia bleed-over between adjacent columns. The lock is
// claimed when a column starts scrolling and released only after that column
// snaps to rest (or is destroyed — see [PORT FIX]). A min-delta gate then
// filters the inertia tail that arrives on neighbours right after the release.
let _activeWheelCol: WheelColumn | null = null;
const WHEEL_MIN_DELTA = 15; // rows/event — below this we treat it as inertia tail

const MOMENTUM_THRESHOLD = 7; // rows/s — above this, momentum; below, snap directly

/* The lock is read and written only through these four helpers. Assigning
 * `this` to the module variable directly trips `@typescript-eslint/no-this-alias`
 * — and naming the operations is clearer than the bare comparisons anyway. */
function wheelLockHeldBy(col: WheelColumn): boolean {
  return _activeWheelCol === col;
}
function wheelLockHeldByOther(col: WheelColumn): boolean {
  return _activeWheelCol !== null && _activeWheelCol !== col;
}
function wheelLockFree(): boolean {
  return _activeWheelCol === null;
}
function claimWheelLock(col: WheelColumn): void {
  _activeWheelCol = col;
}
function releaseWheelLock(col: WheelColumn): void {
  if (_activeWheelCol === col) _activeWheelCol = null;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function readRowHeight(el: HTMLElement): number {
  let raw = getComputedStyle(el).getPropertyValue("--_wheel-row-height").trim();
  if (!raw) {
    raw = getComputedStyle(el.ownerDocument.documentElement)
      .getPropertyValue("--_wheel-row-height")
      .trim();
  }
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? 38 : parsed;
}

interface Slot {
  el: HTMLDivElement;
  o: number;
}

export class WheelColumn {
  private opts: WheelColumnOptions;
  private el: HTMLElement;
  private ring!: HTMLDivElement;
  private slots: Slot[] = [];

  /** Fractional row position. Public in the reference; treat it as internal. */
  pos: number = 0;
  private _currentValue: number | null;
  private _externalSet: boolean = false;
  private _destroyed: boolean = false;

  private rowH: number;
  private radius: number;
  private rowsPerPx: number;
  readonly count: number;
  private _loop: boolean;
  private _format: (value: number) => string;

  private _rafId: number | null = null;
  private _velocity: number = 0;
  private _snapping: boolean = false;
  private _snapTarget: number = 0;

  private _dragActive: boolean = false;
  private _dragLastY: number = 0;
  private _dragLastTime: number = 0;

  private _lastMoveTime: number = 0;

  private _wheelTimer: ReturnType<typeof setTimeout> | null = null;

  private _abortController: AbortController;

  constructor(el: HTMLElement, opts: WheelColumnOptions) {
    this.el = el;
    this.opts = opts;
    this._currentValue = opts.value;
    this.count = opts.max - opts.min + 1;
    this._loop = opts.loop ?? true;
    this._format = opts.format ?? ((v: number) => String(v).padStart(2, "0"));

    this.rowH = readRowHeight(el);
    this.radius = this.rowH / 2 / Math.tan(((STEP_DEG / 2) * Math.PI) / 180);
    this.rowsPerPx = 1 / this.rowH;

    this._abortController = new AbortController();

    this._buildDOM();
    this._bindEvents();

    // Set the initial position without triggering onChange.
    this._externalSet = true;
    if (opts.value !== null) {
      this.pos = this._resolveIndex(opts.value - opts.min);
    } else {
      this.pos = 0;
    }
    this.render();
    this._externalSet = false;
  }

  /* ── DOM ─────────────────────────────────────────────────────────────────── */

  private _buildDOM(): void {
    this.el.setAttribute("role", "spinbutton");
    this.el.setAttribute("aria-valuemin", String(this.opts.min));
    this.el.setAttribute("aria-valuemax", String(this.opts.max));
    if (!this.el.hasAttribute("tabindex")) {
      this.el.setAttribute("tabindex", "0");
    }

    const doc = this.el.ownerDocument;

    this.ring = doc.createElement("div");
    this.ring.className = "ring";
    this.ring.style.transformStyle = "preserve-3d";
    this.ring.style.transform = `translateZ(${-this.radius}px)`;

    for (let o = -HALF; o <= HALF; o++) {
      const slotEl = doc.createElement("div");
      slotEl.className = "option";
      slotEl.setAttribute("aria-hidden", "true");
      this.ring.appendChild(slotEl);
      this.slots.push({ el: slotEl, o });
    }

    const band = doc.createElement("div");
    band.className = "band";

    this.el.appendChild(this.ring);
    this.el.appendChild(band);
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  private _bindEvents(): void {
    const signal = this._abortController.signal;

    this.el.addEventListener("pointerdown", this._onPointerDown, { signal });
    this.el.addEventListener("wheel", this._onWheel as EventListener, {
      passive: false,
      signal,
    });
    this.el.addEventListener("click", this._onClick, { signal });
  }

  private _onPointerDown = (e: PointerEvent): void => {
    if (this._destroyed) return;
    e.preventDefault();
    this._stop();

    this._dragActive = true;
    this._dragLastY = e.clientY;
    this._dragLastTime = performance.now();
    this._velocity = 0;
    this._lastMoveTime = this._dragLastTime;

    this.el.setPointerCapture(e.pointerId);

    const signal = this._abortController.signal;
    this.el.addEventListener("pointermove", this._onPointerMove, { signal });
    this.el.addEventListener("pointerup", this._onPointerUp, { signal });
    this.el.addEventListener("pointercancel", this._onPointerUp, { signal });
  };

  private _onPointerMove = (e: PointerEvent): void => {
    if (!this._dragActive || this._destroyed) return;

    const now = performance.now();
    const dy = e.clientY - this._dragLastY;
    const dtm = now - this._dragLastTime || 16; // ms, avoid division by zero
    const dPos = -dy * this.rowsPerPx;

    this.pos += dPos;
    this._clampPos();
    // Rolling average: weight the recent move 60%, history 40%.
    this._velocity = this._velocity * 0.4 + (dPos / dtm) * 1000 * 0.6;

    this._dragLastY = e.clientY;
    this._dragLastTime = now;
    this._lastMoveTime = now;

    this._externalSet = false;
    this.render();
  };

  private _onPointerUp = (e: PointerEvent): void => {
    if (!this._dragActive || this._destroyed) return;
    this._dragActive = false;

    this.el.releasePointerCapture(e.pointerId);
    this.el.removeEventListener("pointermove", this._onPointerMove);
    this.el.removeEventListener("pointerup", this._onPointerUp);
    this.el.removeEventListener("pointercancel", this._onPointerUp);

    const now = performance.now();
    const idle = now - this._lastMoveTime;

    // Stale velocity guard: held still before release → no flick.
    const v = idle > STALE_IDLE_MS ? 0 : this._velocity;
    // Dampen and cap.
    this._velocity = Math.max(-MAX_V, Math.min(MAX_V, v * 0.4));

    this._externalSet = false;

    if (
      Math.abs(this._velocity) > MOMENTUM_THRESHOLD &&
      !this._prefersReducedMotion()
    ) {
      this._startMomentum();
    } else {
      this._startSnap();
    }
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this._destroyed) return;
    e.preventDefault();

    // Block inertia bleed-over: if another column owns wheel focus, ignore.
    if (wheelLockHeldByOther(this)) return;

    // After the lock releases, require a meaningful delta before accepting
    // events — filters the inertia tail arriving on this column once the
    // previous column's lock expires.
    if (wheelLockFree() && Math.abs(e.deltaY) < WHEEL_MIN_DELTA) return;

    // Claim wheel focus — released in _commit() after the snap completes, or in
    // destroy() if the popup closes first.
    claimWheelLock(this);

    this._stop();
    this._velocity = 0;
    this._externalSet = false;

    this.pos -= e.deltaY / 120;
    this._clampPos();
    this.render();

    if (this._wheelTimer !== null) clearTimeout(this._wheelTimer);
    this._wheelTimer = setTimeout(() => {
      this._wheelTimer = null;
      this._startSnap();
    }, WHEEL_SNAP_DELAY_MS);
  };

  private _onClick = (e: MouseEvent): void => {
    if (this._destroyed) return;
    const option = (e.target as HTMLElement).closest<HTMLElement>(".option");
    if (!option) return;

    const raw = option.dataset.value;
    if (raw == null || raw === "") return;
    const displayValue = Number(raw);
    if (isNaN(displayValue)) return;

    this._externalSet = false;
    const i = this._resolveIndex(displayValue - this.opts.min);
    const target = i + this.count * Math.round((this.pos - i) / this.count);
    this._animateTo(target);
    this._currentValue = displayValue;
  };

  /* ── Physics loop ────────────────────────────────────────────────────────── */

  private _startMomentum(): void {
    if (this._rafId !== null) return;

    let last = performance.now();

    const loop = (now: number): void => {
      if (this._destroyed) return;

      const dt = (now - last) / 1000;
      last = now;

      if (this._snapping) {
        const diff = this._snapTarget - this.pos;
        // Ease toward the snap target.
        this.pos += diff * Math.min(1, dt * 16);
        this.render();

        if (Math.abs(diff) < 0.005) {
          this.pos = this._snapTarget;
          this.render();
          this._commit();
          this._rafId = null;
          this._snapping = false;
          return;
        }
      } else {
        // Apply friction.
        this._velocity *= Math.pow(0.0004, dt);
        this.pos += this._velocity * dt;
        this._clampPos();

        this.render();

        if (Math.abs(this._velocity) < SNAP_THRESHOLD) {
          this._startSnap();
          this._rafId = requestAnimationFrame(loop);
          return;
        }
      }

      this._rafId = requestAnimationFrame(loop);
    };

    this._rafId = requestAnimationFrame(loop);
  }

  private _startSnap(): void {
    this._snapping = true;
    this._snapTarget = Math.round(this.pos);
    this._velocity = 0;

    if (this._rafId === null) {
      this._startMomentum();
    }
  }

  private _animateTo(target: number): void {
    this._stop();
    this._snapping = true;
    this._snapTarget = target;

    if (this._prefersReducedMotion()) {
      this.pos = target;
      this.render();
      this._commit();
      return;
    }

    this._startMomentum();
  }

  private _stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._snapping = false;
    this._velocity = 0;
  }

  /* ── Commit ──────────────────────────────────────────────────────────────── */

  private _commit(): void {
    const index = this._resolveIndex(Math.round(this.pos));
    const value = this.opts.min + index;
    this.pos = index + (this.pos - Math.round(this.pos));
    this._currentValue = value;

    if (!this._externalSet) {
      this.opts.onChange(value);
    }
    // An animated setValue leaves the flag set until its deferred snap lands
    // here — clear it so later user-driven commits fire onChange again.
    this._externalSet = false;

    // Release the wheel lock now that this column has snapped to rest. Short
    // grace period so the snap animation fully settles before adjacent columns
    // accept new wheel events.
    if (wheelLockHeldBy(this)) {
      setTimeout(() => releaseWheelLock(this), 150);
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */

  render(): void {
    const base = Math.round(this.pos);

    let ariaNow: number | null = null;
    let ariaText = "--";

    if (this._currentValue !== null) {
      ariaNow = this._currentValue;
      ariaText = this._format(this._currentValue);
    }

    if (ariaNow !== null) {
      this.el.setAttribute("aria-valuenow", String(ariaNow));
    } else {
      this.el.removeAttribute("aria-valuenow");
    }
    this.el.setAttribute("aria-valuetext", ariaText);

    // NOTE: the id is derived from the host's. Give every `.Wheel` host a unique
    // `id` — otherwise sibling columns all point aria-activedescendant at
    // "wheel-front" and the reference resolves the wrong option. Undocumented
    // in WheelColumn.md; see findings/kernel.md.
    const frontId = `${this.el.id || "wheel"}-front`;

    for (const slot of this.slots) {
      const valRow = base + slot.o;
      const angle = (this.pos - valRow) * STEP_DEG;
      const abs = Math.abs(angle);

      slot.el.style.transform = `rotateX(${angle}deg) translateZ(${this.radius}px)`;

      if (abs > 90) {
        slot.el.style.opacity = "0";
        slot.el.style.visibility = "hidden";
      } else {
        slot.el.style.visibility = "";
        const opacity = Math.max(
          0.1,
          Math.pow(Math.cos((abs * Math.PI) / 180), 1.1),
        );
        slot.el.style.opacity = String(opacity);
      }

      // Bounded wheels render nothing past the ends; looping wheels wrap.
      if (!this._loop && (valRow < 0 || valRow >= this.count)) {
        slot.el.textContent = "";
        delete slot.el.dataset.value;
        slot.el.removeAttribute("aria-selected");
        slot.el.id = "";
        continue;
      }

      const displayIndex = this._loop ? this._mod(valRow) : valRow;
      const displayValue = this.opts.min + displayIndex;
      slot.el.textContent = this._format(displayValue);
      slot.el.dataset.value = String(displayValue);

      const isFront = slot.o === 0;
      slot.el.setAttribute("aria-selected", isFront ? "true" : "false");
      slot.el.id = isFront ? frontId : "";
    }

    this.el.setAttribute("aria-activedescendant", frontId);
  }

  /* ── Index maths ─────────────────────────────────────────────────────────── */

  private _mod(i: number): number {
    return ((i % this.count) + this.count) % this.count;
  }

  /** Looping wheels wrap an index into range; bounded wheels clamp to the ends. */
  private _resolveIndex(i: number): number {
    return this._loop ? this._mod(i) : Math.max(0, Math.min(this.count - 1, i));
  }

  /** Bounded wheels can't scroll past the ends — clamp and kill velocity at an edge. */
  private _clampPos(): void {
    if (this._loop) return;
    const max = this.count - 1;
    if (this.pos < 0) {
      this.pos = 0;
      this._velocity = 0;
    } else if (this.pos > max) {
      this.pos = max;
      this._velocity = 0;
    }
  }

  /* ── prefers-reduced-motion ──────────────────────────────────────────────── */

  _prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */

  /** External set — syncs the wheel from the field and does NOT fire onChange. */
  setValue(value: number | null, animate = true): void {
    this._externalSet = true;

    if (value === null) {
      this._currentValue = null;
      this._stop();
      this.pos = 0;
      this.render();
      this._externalSet = false;
      return;
    }

    const i = this._resolveIndex(value - this.opts.min);
    const target = i + this.count * Math.round((this.pos - i) / this.count);

    // Set the value BEFORE rendering so aria-valuenow / aria-valuetext reflect
    // it (render reads _currentValue). _externalSet prevents onChange.
    this._currentValue = value;

    if (animate && !this._prefersReducedMotion()) {
      // The flag must survive until the eased snap commits (next rAF frames),
      // so _commit() clears it — not us. User gestures that interrupt the
      // animation (drag/wheel/click/stepBy) all reset it to false themselves.
      this._animateTo(target);
    } else {
      this._stop();
      this.pos = target;
      this.render();
      this._externalSet = false;
    }
  }

  /** Keyboard ±1 etc. Animates and DOES fire onChange. */
  stepBy(delta: number): void {
    const base = this._currentValue ?? this.opts.min;
    const nextIndex = this._resolveIndex(base - this.opts.min + delta);
    const nextValue = this.opts.min + nextIndex;

    this._externalSet = false;

    const i = nextIndex;
    const target = i + this.count * Math.round((this.pos - i) / this.count);
    // Set before animating so the render inside _animateTo reflects the value.
    this._currentValue = nextValue;
    this._animateTo(target);
  }

  get value(): number | null {
    return this._currentValue;
  }

  destroy(): void {
    this._destroyed = true;
    this._stop();

    if (this._wheelTimer !== null) {
      clearTimeout(this._wheelTimer);
      this._wheelTimer = null;
    }

    // [PORT FIX] Release the module-level cross-column wheel lock. The
    // reference does not, so closing the popup while a column still holds the
    // lock (scroll, then Escape within WHEEL_SNAP_DELAY_MS — destroy() clears
    // _wheelTimer, so _startSnap and therefore _commit never run) strands
    // _activeWheelCol on a destroyed instance. Every wheel column in the
    // application then fails the `_activeWheelCol !== this` guard forever,
    // because the lock is module state that outlives the popup. Reported in
    // findings/kernel.md; covered by a regression test.
    releaseWheelLock(this);

    this._abortController.abort();
  }
}

export default WheelColumn;
