/* RangeGroup's behaviour, as ONE self-contained function.
 *
 * WHY THIS FILE EXISTS — a measured timing fact, not a preference.
 *
 * Upstream, `src/js/script.js` calls `RangeGroup.attach()` at module evaluation
 * of `<script type="module" src="/main.js">`. A non-async module script is
 * deferred, and a deferred script DELAYS THE LOAD EVENT — so upstream every
 * group is wired before `load`, which is precisely when Playwright's
 * `page.goto()` resolves. That is why nine of `RangeGroup.e2e.test.js`'s
 * assertions read `__rangeGroupInstance`, `aria-valuemax` and `data-on-top`
 * straight after `goto` with no gate of any kind: upstream there is nothing to
 * wait for.
 *
 * Next.js inverts that. Every client chunk is injected as
 * `<script src=… async>` (verified against the served HTML of `/`), and an
 * `async` script does NOT delay `load`. So neither React hydration NOR a
 * module-scope `attach()` in a client component can run before `page.goto`
 * returns. Measured on the aggregate `/`, dev server, Chromium, four runs each:
 *
 *   hydration-only effect     : instance present 86–141 ms AFTER goto resolved
 *   module-scope attach()     : instance present 54–91 ms  AFTER goto resolved
 *   this inline bootstrap     : instance present BEFORE goto resolved
 *
 * The window is not a test artefact. For that ~100 ms after the page has
 * finished loading, a hydration-only RangeGroup does not clamp, does not
 * announce its span and cannot arbitrate an overlapping pair — a user dragging
 * in that window gets raw, unclamped native behaviour on both handles. Making
 * the tests wait would have hidden a real defect rather than fixed one.
 *
 * An inline `<script>` in the streamed body is parser-blocking, so it runs while
 * the HTML is still being parsed. It is the same technique the reference uses in
 * `index.html` for the appearance script, and the same one PORTING.md's
 * "Preventing FOUC" section prescribes — applied to behaviour rather than paint.
 *
 * CONSTRAINT: this function is serialised with `String(rangeGroupAttach)` and
 * embedded in the page, so it must be **fully self-contained** — no imports, no
 * module-scope references, no TypeScript-only syntax that survives into the
 * emitted source. Only DOM globals. The React component imports the same
 * function and calls it from an effect, so there is exactly one implementation
 * and nothing can drift.
 *
 * It is idempotent: `__rangeGroupInstance` is the guard, exactly as the
 * reference's `attach()` guards on it, so the inline call and the effect call
 * never double-bind.
 */
export function rangeGroupAttach(): void {
  const groups = document.querySelectorAll('[data-component="RangeGroup"]');

  for (let i = 0; i < groups.length; i++) {
    wireOne(groups[i] as HTMLElement);
  }

  function wireOne(root: HTMLElement): void {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mounted = root as any;
    if (mounted.__rangeGroupInstance) return;

    const scale = root.querySelector(".RangeScale") as HTMLElement | null;
    const lower = root.querySelector('[data-role="lower"]') as HTMLInputElement | null;
    const upper = root.querySelector('[data-role="upper"]') as HTMLInputElement | null;
    if (!scale || !lower || !upper) return;

    const lo = lower;
    const hi = upper;
    const lane = scale;

    const readoutOf = function (side: string): HTMLElement | null {
      return root.querySelector('[data-readout="' + side + '"]') as HTMLElement | null;
    };
    const digitsOf = function (side: string): HTMLElement | null {
      const r = readoutOf(side);
      return r ? (r.querySelector(".digits") as HTMLElement | null) : null;
    };

    /* Both readouts carry the same unit; the lower one is the canonical source,
       read from the DOM exactly as the reference reads it. */
    const loReadout = readoutOf("lower");
    const hiReadout = readoutOf("upper");
    const unit =
      (loReadout && loReadout.getAttribute("data-suffix")) ||
      (hiReadout && hiReadout.getAttribute("data-suffix")) ||
      "";

    const format = function (field: HTMLInputElement): string {
      return unit ? field.value + " " + unit : field.value;
    };

    const position = function (field: HTMLInputElement): number {
      const min = Number(field.min || 0);
      const max = Number(field.max || 100);
      const span = max - min;
      return span === 0 ? 0 : (field.valueAsNumber - min) / span;
    };

    /* The lane's own job. Positions are sorted by VALUE rather than document
       order: a clamping owner may have just corrected one of them, and this runs
       in the same tick, before anything paints. */
    const publish = function (): void {
      const pa = position(lo);
      const pb = position(hi);
      lane.style.setProperty("--_rs-a", String(Math.min(pa, pb)));
      lane.style.setProperty("--_rs-b", String(Math.max(pa, pb)));
      lane.style.setProperty("--_rs-p", String(pb));
    };

    const sync = function (): void {
      const span = unit
        ? lo.value + "–" + hi.value + " " + unit
        : lo.value + "–" + hi.value;

      /* The narrowed span, exposed through ARIA because the ATTRIBUTES stay put:
         changing `max` would shrink that input's own travel and the two would
         stop sharing a coordinate system. */
      lo.setAttribute("aria-valuemax", hi.value);
      hi.setAttribute("aria-valuemin", lo.value);

      /* And carried in words, which is the half honoured everywhere. It must NOT
         repeat the role — the <label> already said which end this is, and a
         screenreader announces name, then role, then this. */
      lo.setAttribute("aria-valuetext", format(lo) + ", within " + span);
      hi.setAttribute("aria-valuetext", format(hi) + ", within " + span);

      /* Only the number is written; the unit is markup and stays put. */
      const dLo = digitsOf("lower");
      const dHi = digitsOf("upper");
      if (dLo) dLo.textContent = lo.value;
      if (dHi) dHi.textContent = hi.value;

      publish();
    };

    /* Hard stop: only the control the user is holding moves. Push would silently
       move an untouched value with nothing announcing it; swap would change a
       control's identity mid-interaction while focus stayed put, which no ARIA
       mechanism can announce. */
    const clamp = function (touched: string): void {
      if (lo.valueAsNumber > hi.valueAsNumber) {
        if (touched === "lower") lo.value = hi.value;
        else hi.value = lo.value;
      }
      sync();
    };

    const onLower = function (): void {
      clamp("lower");
    };
    const onUpper = function (): void {
      clamp("upper");
    };

    /* pointermove as well as pointerdown: by the time a pointerdown listener
       runs the browser has already hit-tested and chosen a target, so raising a
       thumb there would only ever fix the FOLLOWING press. */
    const onPointerMove = function (event: PointerEvent): void {
      const box = lane.getBoundingClientRect();
      const rtl = getComputedStyle(lane).direction === "rtl";
      const fraction = rtl
        ? (box.right - event.clientX) / box.width
        : (event.clientX - box.left) / box.width;

      const pLower = position(lo);
      const pUpper = position(hi);
      const dLower = Math.abs(fraction - pLower);
      const dUpper = Math.abs(fraction - pUpper);

      /* On the same value the distances are identical, so distance cannot break
         the tie: SIDE does. Without this one end is permanently unreachable the
         moment they meet, and the pair becomes a dead control. Read along the
         lane's INLINE axis, so it holds in RTL where the lower end is on the
         right. */
      const nearerLower =
        Math.abs(dLower - dUpper) < 1e-9 ? fraction < pLower : dLower < dUpper;

      /* Both states are written explicitly — the documented exception to the
         library's "true or absent" rule — because exactly one thumb is on top at
         any moment, so the off state carries style too. */
      lo.setAttribute("data-on-top", String(nearerLower));
      hi.setAttribute("data-on-top", String(!nearerLower));
    };

    lo.addEventListener("input", onLower);
    hi.addEventListener("input", onUpper);
    lane.addEventListener("pointermove", onPointerMove);
    lane.addEventListener("pointerdown", onPointerMove);

    /* Not a gap-fill: the server already rendered the positions, the readouts AND
       the ARIA span, so nothing here changes the DOM on a fresh load. It covers a
       browser that restored different values on reload, and it is what makes the
       clamp safe without coordinating listener order. */
    sync();

    /* The two public handles the suite calls. Both have to be SYNCHRONOUS — it
       reads `getComputedStyle` on the line after `sync()` — which is exactly why
       they are imperative rather than React state. */
    mounted.__rangeGroupInstance = { sync: sync };
    (lane as any).__rangeScaleInstance = { sync: publish };
  }
}

/** The inline script body. `String(fn)` rather than a hand-copied template
 *  literal, so the embedded implementation and the imported one can never drift.
 *
 *  The `readyState` gate is load-bearing: a parser-blocking script runs at the
 *  point it appears in the document, which is BEFORE the markup below it has been
 *  parsed — the first attempt at this wired zero groups for exactly that reason.
 *  `DOMContentLoaded` fires after parsing and after deferred scripts, but still
 *  before `load`, so it beats `page.goto()` while staying independent of where in
 *  the document the script is placed. */
export function rangeGroupBootstrapSource(): string {
  return (
    "(function(f){if(document.readyState===\"loading\")" +
    "{document.addEventListener(\"DOMContentLoaded\",f,{once:true});}else{f();}})(" +
    String(rangeGroupAttach) +
    ");"
  );
}
