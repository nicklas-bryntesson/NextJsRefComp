"use client";

/* ScrollArea — React port of
 * reference-components/src/partials/components/ScrollArea.
 *
 * This one genuinely needs 'use client'. Unlike AffixField (whose JS only
 * *computes attributes*, so it ports to a Server Component with zero client JS),
 * ScrollArea's JS **measures the DOM**: whether the content overflows is a fact
 * about rendered layout that no server can know. Everything downstream of that
 * measurement — `tabindex="0"` on the region, the existence of the custom bar,
 * the thumb's geometry — is therefore client-only by construction.
 *
 * The reference's model, preserved exactly:
 *
 *   ONE source of truth — `viewport.scrollLeft`. The thumb is a pure PROJECTION
 *   of (metrics, scrollLeft). Pointer interactions mutate only scrollLeft; the
 *   resulting `scroll` event re-projects the thumb.
 *
 * Where the port splits from React orthodoxy, and why:
 *
 *   - `hasOverflow` is React state. It changes at most once per resize
 *     breakpoint and it drives one declarative attribute (`tabIndex` on the
 *     viewport), so state is the right home for it.
 *   - The thumb's width/transform and the bar's `data-visible` / `hidden` are
 *     written IMPERATIVELY to the DOM through refs. They change on every scroll
 *     frame and during a pointer drag; routing them through `setState` would
 *     re-render the whole subtree (a wide table) 60×/s for values that are, by
 *     the contract's own words, a projection rather than state. This is still
 *     "reflect state into the DOM" — it is just written with a ref instead of a
 *     prop.
 *   - `measure()` must set `bar.hidden = false` BEFORE reading `bar.clientWidth`
 *     (a hidden bar reports 0 and the thumb would render at width 0). That
 *     read-after-write ordering is impossible if `hidden` is a React prop, since
 *     the DOM would only catch up after the next commit. Hence `hidden` is one
 *     of the imperative writes.
 *
 * Progressive enhancement is preserved: `data-scrollbar="true"` and the custom
 * bar are gated on a hydration flag read through `useSyncExternalStore` (whose
 * SERVER snapshot is `false`), so the server-rendered markup (= the no-JS end
 * state) carries neither, and the CSS leaves the native scrollbar visible. That
 * gate is also the source of a first-paint window where the region has no
 * `tabindex` — see findings/ScrollArea.md.
 *
 * Class names are structural, not decorative: `.ScrollArea`, `.viewport`,
 * `.content`, `.fades`, `.scrollbar`, `.thumb` are selected by the verbatim
 * stylesheet, and `[data-scroll-viewport]` by the conformance suite. Preserved
 * exactly; utilities layer alongside in Phase B, never instead. See F-008.
 */

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import "./ScrollArea.layered.css";

/* ── Hydration as an external store ───────────────────────────────────────────
 *
 * "Has this component's JS run yet?" is not React state — it is a fact about the
 * host, outside React, with exactly the subscribe/snapshot shape
 * `useSyncExternalStore` exists for. Nothing ever changes it after hydration, so
 * `subscribe` is a no-op; the whole point is the pair of snapshots: the SERVER
 * snapshot is `false` ("nothing measured yet") and the client snapshot is `true`.
 *
 * That single distinction is what makes the progressive-enhancement gate honest
 * AND lint-clean. The literal port of the reference's `attach()` — `useState`
 * plus `useEffect(() => setMounted(true), [])` — is a react-hooks/
 * set-state-in-effect ERROR under React 19's compiler rules, not merely
 * unidiomatic. Same DOM, same timing, no setState in an effect body. The
 * MotionRegion port arrived at the identical shape independently; see
 * findings/ScrollArea.md.
 */

const noopSubscribe = () => () => {};
const getHydrated = () => true;
const getHydratedServer = () => false;

/* ── Options (the reference's DEFAULTS) ─────────────────────────────────────── */

const MIN_THUMB = 24; // px — floor on thumb length so it stays grabbable
const PAGE_FACTOR = 0.9; // fraction of a viewport per track-click "page"
const HIDE_DELAY = 900; // ms of inactivity before the bar fades out
const OVERFLOW_EPSILON = 1; // px — ignore sub-pixel overflow

/* ── Pure functions, ported 1:1 from ScrollArea.ts ──────────────────────────── */

export interface Metrics {
  clientWidth: number;
  scrollWidth: number;
  maxScroll: number;
  hasOverflow: boolean;
  trackWidth: number;
}

/** scrollWidth − clientWidth, floored at 0; overflow only when it clears epsilon
 *  (ignore sub-pixel "overflow" that would flicker the bar in and out). */
export function resolveMaxScroll(
  clientWidth: number,
  scrollWidth: number,
  epsilon: number,
): { maxScroll: number; hasOverflow: boolean } {
  const maxScroll = Math.max(0, scrollWidth - clientWidth);
  return { maxScroll, hasOverflow: maxScroll > epsilon };
}

/** Project (metrics, scrollLeft) → thumb geometry. Never mutates. */
export function projectThumb(
  m: Metrics,
  scrollLeft: number,
  minThumb: number,
): { thumbWidth: number; x: number } {
  const { clientWidth, scrollWidth, maxScroll, trackWidth } = m;
  if (trackWidth <= 0 || scrollWidth <= 0) return { thumbWidth: 0, x: 0 };

  const visibleRatio = Math.min(1, clientWidth / scrollWidth);
  const thumbWidth = Math.max(minThumb, Math.round(visibleRatio * trackWidth));
  const travel = Math.max(0, trackWidth - thumbWidth);
  const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
  const clamped = Math.min(1, Math.max(0, progress));
  return { thumbWidth, x: Math.round(clamped * travel) };
}

/* ── State machine, ported 1:1 ─────────────────────────────────────────────── */

export const STATE = Object.freeze({
  DISABLED: "disabled", // content fits — bar removed, region not focusable
  IDLE: "idle", // overflow present — resting
  DRAGGING: "dragging", // thumb being dragged
  DESTROYED: "destroyed", // torn down — terminal
} as const);

export type State = (typeof STATE)[keyof typeof STATE];

export const EVENT = Object.freeze({
  MEASURE: "MEASURE",
  THUMB_POINTER_DOWN: "THUMB_POINTER_DOWN",
  POINTER_MOVE: "POINTER_MOVE",
  POINTER_UP: "POINTER_UP",
  POINTER_CANCEL: "POINTER_CANCEL",
  TRACK_POINTER_DOWN: "TRACK_POINTER_DOWN",
  SCROLL: "SCROLL",
  DESTROY: "DESTROY",
} as const);

export type EventName = (typeof EVENT)[keyof typeof EVENT];

const TRANSITIONS: Record<State, Partial<Record<EventName, State>>> = Object.freeze({
  [STATE.DISABLED]: { [EVENT.DESTROY]: STATE.DESTROYED },
  [STATE.IDLE]: { [EVENT.THUMB_POINTER_DOWN]: STATE.DRAGGING, [EVENT.DESTROY]: STATE.DESTROYED },
  [STATE.DRAGGING]: {
    [EVENT.POINTER_UP]: STATE.IDLE,
    [EVENT.POINTER_CANCEL]: STATE.IDLE,
    [EVENT.DESTROY]: STATE.DESTROYED,
  },
  [STATE.DESTROYED]: {},
});

/** MEASURE is data-driven (overflow decides idle/disabled); every other
 *  transition is a table lookup. Returns the same state when the event is
 *  illegal from here — the caller only acts on an actual change. */
export function resolveNextState(state: State, event: EventName, hasOverflow: boolean): State {
  if (state === STATE.DESTROYED) return STATE.DESTROYED;
  if (event === EVENT.MEASURE) {
    // A re-measure must never interrupt a drag (that would release pointer
    // capture mid-gesture). Metrics still refresh; only the state change is
    // suppressed.
    if (state === STATE.DRAGGING) return STATE.DRAGGING;
    return hasOverflow ? STATE.IDLE : STATE.DISABLED;
  }
  return TRANSITIONS[state][event] ?? state;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export type ScrollAreaProps = {
  /** The overflowing content. Wrapped in `.content` for you. */
  children: ReactNode;
  /** Accessible name for the scroll region. The contract wants a meaningful one;
   *  the reference gap-fills "Scrollable content" when the author omits it, so
   *  that is the default here rather than a required prop. */
  ariaLabel?: string;
  /** Alternative to `ariaLabel`. When given, no `aria-label` is emitted. */
  ariaLabelledby?: string;
  /** `data-id` anchor. `scrollarea-live` is the conformance target — see
   *  `e2e-helpers/target.js`. */
  dataId?: string;
  /** Utilities on the root. The structural `.ScrollArea` class is always kept. */
  className?: string;
  /** For the documented custom-property API (`--_sc-offset`, `--_sc-fade-color`,
   *  `--_sc-fade-size`) and for demo sizing. */
  style?: CSSProperties;
  /** Utilities on `.content`. The structural class is always kept. */
  contentClassName?: string;
  contentStyle?: CSSProperties;
};

export function ScrollArea({
  children,
  ariaLabel,
  ariaLabelledby,
  dataId,
  className,
  style,
  contentClassName,
  contentStyle,
}: ScrollAreaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  /* Gates the whole enhancement. False on the server and on the hydrating
     render, which is exactly the no-JS end state; true from the first
     post-hydration render onward. */
  const hydrated = useSyncExternalStore(noopSubscribe, getHydrated, getHydratedServer);

  /* The one measurement that has to reach React: it drives `tabIndex`. */
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!root || !viewport || !bar || !thumb) return;

    /* Mutable machine state. Refs, not React state: the reference reads these
       synchronously inside pointer handlers, where a stale closure over a
       useState value would scrub the thumb from the wrong origin. */
    let state: State = STATE.DISABLED;
    let m: Metrics = {
      clientWidth: 0,
      scrollWidth: 0,
      maxScroll: 0,
      hasOverflow: false,
      trackWidth: 0,
    };
    let dragPointerId: number | null = null;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let hovering = false;
    let hideTimer = 0;
    let measureScheduled = false;
    let raf = 0;

    /* ── metrics & projection ──────────────────────────────────────────────── */

    const render = () => {
      if (state === STATE.DISABLED || state === STATE.DESTROYED) return;
      const { thumbWidth, x } = projectThumb(m, viewport.scrollLeft, MIN_THUMB);
      if (thumbWidth <= 0) return;
      thumb.style.inlineSize = `${thumbWidth}px`;
      thumb.style.transform = `translateX(${x}px)`;
    };

    const measure = () => {
      const { maxScroll, hasOverflow: over } = resolveMaxScroll(
        viewport.clientWidth,
        viewport.scrollWidth,
        OVERFLOW_EPSILON,
      );
      /* The bar must be in layout BEFORE we read its width, else a hidden bar
         reports clientWidth 0 and the thumb renders at width 0 on first show.
         This read-after-write is why `hidden` is imperative here. */
      bar.hidden = !over;
      const trackWidth = over ? bar.clientWidth : 0;

      m = {
        clientWidth: viewport.clientWidth,
        scrollWidth: viewport.scrollWidth,
        maxScroll,
        hasOverflow: over,
        trackWidth,
      };
      /* Publish the one fact React owns. Same-value setState is a no-op, so a
         resize that does not change overflow costs no render. */
      setHasOverflow(over);
      if (state === STATE.IDLE && over) render();
    };

    /* ── visibility / auto-hide ────────────────────────────────────────────── */

    const clearHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
    };

    const armHide = () => {
      clearHide();
      hideTimer = window.setTimeout(() => {
        // Never hide mid-drag or while hovering.
        if (state === STATE.DRAGGING || hovering) return;
        delete bar.dataset.visible;
      }, HIDE_DELAY);
    };

    const show = () => {
      if (state === STATE.DISABLED || state === STATE.DESTROYED) return;
      bar.dataset.visible = "true";
      armHide();
    };

    /* ── pointer interactions (everything funnels into scrollLeft) ──────────── */

    const currentThumbLeft = () => {
      const travel = m.trackWidth - thumb.offsetWidth;
      const progress = m.maxScroll > 0 ? viewport.scrollLeft / m.maxScroll : 0;
      return Math.min(1, Math.max(0, progress)) * Math.max(0, travel);
    };

    const beginDrag = (e?: PointerEvent) => {
      if (!e) return;
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartScroll = viewport.scrollLeft;
      try {
        thumb.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      show();
      e.preventDefault();
    };

    const scrub = (e: PointerEvent) => {
      if (!e || e.pointerId !== dragPointerId) return;
      const travel = m.trackWidth - thumb.offsetWidth;
      if (travel <= 0) return;
      const dx = e.clientX - dragStartX;
      viewport.scrollLeft = dragStartScroll + (dx / travel) * m.maxScroll;
      // the scroll event does the render.
    };

    const endDrag = () => {
      if (dragPointerId != null) {
        try {
          thumb.releasePointerCapture(dragPointerId);
        } catch {
          /* release is best-effort */
        }
      }
      dragPointerId = null;
      armHide();
    };

    const page = (e: PointerEvent) => {
      const rect = bar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const dir = clickX < currentThumbLeft() ? -1 : 1;
      const step = m.clientWidth * PAGE_FACTOR;
      viewport.scrollLeft = Math.min(m.maxScroll, Math.max(0, viewport.scrollLeft + dir * step));
    };

    /* ── the machine ───────────────────────────────────────────────────────── */

    const enter = (next: State, payload?: Event) => {
      switch (next) {
        case STATE.DISABLED:
          bar.hidden = true;
          clearHide();
          break;
        case STATE.IDLE:
          bar.hidden = false;
          render();
          break;
        case STATE.DRAGGING:
          beginDrag(payload as PointerEvent);
          break;
        case STATE.DESTROYED:
          break;
      }
      /* `tabindex` is the declarative half: DISABLED → not a tab stop,
         IDLE/DRAGGING → focusable. React owns it via `hasOverflow`; measure()
         has already published it. */
    };

    const send = (event: EventName, payload?: Event) => {
      if (state === STATE.DESTROYED) return;

      // 1) Side-effects that need no state change.
      switch (event) {
        case EVENT.MEASURE:
          measure();
          break;
        case EVENT.SCROLL:
          render();
          show();
          break;
        case EVENT.POINTER_MOVE:
          if (state === STATE.DRAGGING) scrub(payload as PointerEvent);
          break;
        case EVENT.TRACK_POINTER_DOWN:
          if (payload && (payload as PointerEvent).target !== thumb) page(payload as PointerEvent);
          break;
      }

      // 2) Resolve and apply the state change.
      const next = resolveNextState(state, event, m.hasOverflow);
      if (next !== state) {
        if (state === STATE.DRAGGING) endDrag();
        state = next;
        enter(next, payload);
      }
    };

    const scheduleMeasure = () => {
      if (measureScheduled) return;
      measureScheduled = true;
      raf = requestAnimationFrame(() => {
        measureScheduled = false;
        send(EVENT.MEASURE);
      });
    };

    /* ── wiring ────────────────────────────────────────────────────────────── */

    const onScroll = () => send(EVENT.SCROLL);
    const onThumbDown = (e: PointerEvent) => send(EVENT.THUMB_POINTER_DOWN, e);
    const onPointerMove = (e: PointerEvent) => send(EVENT.POINTER_MOVE, e);
    const onPointerUp = (e: PointerEvent) => send(EVENT.POINTER_UP, e);
    const onPointerCancel = (e: PointerEvent) => send(EVENT.POINTER_CANCEL, e);
    const onTrackDown = (e: PointerEvent) => send(EVENT.TRACK_POINTER_DOWN, e);
    const onEnter = () => {
      hovering = true;
      if (state !== STATE.DISABLED) show();
    };
    const onLeave = () => {
      hovering = false;
      armHide();
    };
    const onMeasure = () => scheduleMeasure();

    viewport.addEventListener("scroll", onScroll, { passive: true });
    thumb.addEventListener("pointerdown", onThumbDown);
    thumb.addEventListener("pointermove", onPointerMove);
    thumb.addEventListener("pointerup", onPointerUp);
    thumb.addEventListener("pointercancel", onPointerCancel);
    bar.addEventListener("pointerdown", onTrackDown);
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);

    /* Metrics change → MEASURE. Observe the viewport (clientWidth) and its
       scrolling content (scrollWidth), plus row/content mutations. */
    const ro = new ResizeObserver(onMeasure);
    ro.observe(viewport);
    if (viewport.firstElementChild) ro.observe(viewport.firstElementChild);
    const mo = new MutationObserver(onMeasure);
    mo.observe(viewport, { childList: true, subtree: true });

    scheduleMeasure();

    return () => {
      send(EVENT.DESTROY);
      state = STATE.DESTROYED;
      clearHide();
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      viewport.removeEventListener("scroll", onScroll);
      thumb.removeEventListener("pointerdown", onThumbDown);
      thumb.removeEventListener("pointermove", onPointerMove);
      thumb.removeEventListener("pointerup", onPointerUp);
      thumb.removeEventListener("pointercancel", onPointerCancel);
      bar.removeEventListener("pointerdown", onTrackDown);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [hydrated]);

  return (
    <div
      ref={rootRef}
      className={className ? `ScrollArea ${className}` : "ScrollArea"}
      data-component="ScrollArea"
      data-id={dataId}
      /* Progressive enhancement gate. The CSS hides the native bar only once
         this is present, so the no-JS render keeps the native affordance. */
      data-scrollbar={hydrated ? "true" : undefined}
      style={style}
    >
      <div
        ref={viewportRef}
        className="viewport"
        data-scroll-viewport=""
        role="region"
        aria-label={ariaLabelledby ? undefined : (ariaLabel ?? "Scrollable content")}
        aria-labelledby={ariaLabelledby}
        /* Focusable only while it overflows — nothing to scroll is not a tab
           stop. `undefined` is the library's "absent"; React omits the
           attribute entirely rather than emitting tabindex="-1". */
        tabIndex={hasOverflow ? 0 : undefined}
      >
        <div className={contentClassName ? `content ${contentClassName}` : "content"} style={contentStyle}>
          {children}
        </div>
      </div>

      {/* Must come after the viewport in the DOM (stacking) and is decorative. */}
      <div className="fades" aria-hidden="true" />

      {/* Created by JS in the reference; rendered only once hydrated here, which
          is the same end state. aria-hidden + no tabindex: a pointer/visual
          affordance, never a second tab stop. `hidden` is handed to the effect
          after this first render — see measure(). */}
      {hydrated && (
        <div ref={barRef} className="scrollbar" hidden aria-hidden="true">
          <div ref={thumbRef} className="thumb" />
        </div>
      )}
    </div>
  );
}

export default ScrollArea;
