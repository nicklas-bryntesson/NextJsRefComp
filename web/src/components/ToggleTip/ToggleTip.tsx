/* ToggleTip — React port of reference-components/src/partials/components/ToggleTip.
 *
 * `'use client'` is unavoidable here: unlike AffixField, this component's JS does
 * not merely compute attributes. It measures three live rects (trigger, rail,
 * popup) plus three resolved CSS lengths on every open, and it owns four runtime
 * listeners (button click, window resize, document mousedown, component
 * focusout). None of that can be an end-state render.
 *
 * ── The root really is `<toggle-tip>` ────────────────────────────────────────
 * Not a stylistic choice. The verbatim stylesheet qualifies EVERY rule from the
 * custom-element root (`toggle-tip .popup { … }`, ADR-0019) and the conformance
 * suite locates the component as `toggle-tip[data-id="…"]`. Rendering a `<div>`
 * with a class would fail both. No custom element is *defined* — this is an
 * unknown element that the parser and React both treat as inert, which is
 * exactly what we want: no upgrade, no hydration surprise.
 *
 * ── What is NOT ported ───────────────────────────────────────────────────────
 * - `_buildDOM()` / `innerHTML` / the `crypto.randomUUID()` id. React renders
 *   formed markup; the id comes from `useId()` so server and client agree.
 * - the `initialized` init gate in CSS (dropped, PORTING.md) — the ATTRIBUTE is
 *   still rendered, per Findings F-010.
 * - `destroy()`. React's effect cleanups are the same thing, expressed once.
 * - the `title` ATTRIBUTE. ToggleTip.md's "Known attribute conflict" section
 *   asks framework implementations to rename it, because a `title` attribute on
 *   the host makes the browser paint a *native* tooltip over an accessible one.
 *   The prop here is `heading`; nothing named `title` ever reaches the DOM. The
 *   `.title` CLASS is untouched — it is contract.
 *
 * ── Positioning stays in normal flow (no portal, no Popover API) ─────────────
 * ADR-0012 makes the top-layer escape the consuming project's call, and for this
 * component the answer is "not yet, and not by default":
 *   1. A portal makes `.rail` / `.popup` non-descendants of `toggle-tip`. Every
 *      rule in the verbatim stylesheet is `toggle-tip .x` and the suite selects
 *      `.popup` — so a portal forces both a stylesheet rewrite and ADR-0019's
 *      "detached part" renaming (`.ToggleTip-popup`), which the e2e selectors do
 *      not accept. The cost is a broken contract, not a refactor.
 *   2. `popover` / top layer would also hand light-dismiss focus semantics to the
 *      platform, which ADR-0012 itself flags as needing a re-check against
 *      ADR-0007 (light-dismiss must never refocus the trigger).
 * We keep the reference's substrate and inherit the reference's documented
 * ancestor-clipping limitation. See findings/ToggleTip.md.
 */

"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";

import {
  calculateArrowOffset,
  calculatePopupOffset,
  detectDirection,
  type PopupDirection,
} from "@/kernel/popup-position";
import { resolveCssPx } from "@/kernel/css-px";

/* The component owns its stylesheet — deletable in one move, and parallel ports
   never contend for a shared import list. */
import "./ToggleTip.css";

/* `toggle-tip` is not in React's intrinsic-element table and we deliberately do
   not augment the global JSX namespace: this element belongs to one component,
   so the typing belongs next to it. At runtime this is still the string
   "toggle-tip" and React emits every prop below as a plain attribute. */
type ToggleTipRootProps = {
  ref?: Ref<HTMLElement>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Contract attribute set by the reference JS at init. Bare, valueless. */
  initialized?: string;
  "data-id"?: string;
  "data-direction"?: PopupDirection;
  icon?: string;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
};
const ToggleTipRoot = "toggle-tip" as unknown as (props: ToggleTipRootProps) => ReactNode;

export type ToggleTipIcon = "info" | "question";

export type ToggleTipProps = {
  /** Bubble content. */
  children?: ReactNode;
  /** Button icon shape. Also picks the default `aria-label`. */
  icon?: ToggleTipIcon;
  /** Heading inside the bubble. This is ToggleTip.md's `title` attribute,
   *  renamed as that document instructs, to avoid the native-tooltip conflict. */
  heading?: string;
  /** `aria-level` for the heading. Contract default `3`. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Overrides the icon-derived `aria-label`. The contract asks implementers to
   *  match the surrounding context rather than ship "More information" blindly. */
  label?: string;
  /** e2e anchor. Rendered as `data-id` on the custom element root. */
  dataId?: string;
  /** Utilities layered ALONGSIDE the structural markup (Phase B seam, F-008). */
  className?: string;
};

/* ── Icons ─────────────────────────────────────────────────────────────────── */
/* Ported from generateIconSVG(). `class="icon"` is contract — the stylesheet
   sizes `toggle-tip button .icon`. `focusable="false"` is added: the reference
   built these with innerHTML where legacy IE focusability is moot, but a JSX SVG
   in a real page is safer explicitly inert. */

const ICON_PATHS: Record<ToggleTipIcon, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
};

function Icon({ icon }: { icon: ToggleTipIcon }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

const DEFAULT_LABEL: Record<ToggleTipIcon, string> = {
  info: "More information",
  question: "Learn more",
};

/* ── CSS length resolution ─────────────────────────────────────────────────── */
/* PROMOTED TO THE KERNEL. `resolveCssPx` used to live here as a direct port of
   the reference `_getCSSPx()` probe, with a note recommending promotion once a
   second consumer arrived. The five popup date/time fields are that second
   consumer (the reference duplicates the same probe in all six components), so
   it is now `@/kernel/css-px` with its own conformance test. Behaviour is
   unchanged: `getComputedStyle().getPropertyValue()` returns `calc()` / `rem` /
   `var()` chains unresolved, so the only honest resolution is to substitute the
   property into a probe appended INSIDE this component root, measure it, and
   remove it synchronously. */

/* ── Component ─────────────────────────────────────────────────────────────── */

export function ToggleTip({
  children,
  icon = "info",
  heading,
  headingLevel = 3,
  label,
  dataId,
  className,
}: ToggleTipProps) {
  const popupId = `tt-${useId()}`;

  const rootRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  /* "top" is the contract's default placement, and using it as the initial value
     on BOTH server and client keeps hydration identical. The real measurement
     happens on mount (and again on every open and resize), exactly as the
     reference computes direction at init rather than lazily. */
  const [direction, setDirection] = useState<PopupDirection>("top");

  const measureDirection = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    setDirection(detectDirection(root.getBoundingClientRect()));
  }, []);

  /* Port of _updateLayout(). Writes the two JS-owned custom properties straight
     onto the root with setProperty, rather than through the `style` prop: the
     values are derived from a rect that only exists AFTER the open render has
     been laid out, so routing them through state would cost a second render and
     a frame of mis-positioned bubble. Nothing else writes `style` on this
     element, so React never clobbers them. */
  const updateLayout = useCallback(() => {
    const root = rootRef.current;
    const rail = railRef.current;
    const popup = popupRef.current;
    if (!root || !rail || !popup) return;

    const containerRect = rail.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    if (!containerRect.width || !popupRect.width) return;

    const triggerRect = root.getBoundingClientRect();
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    const arrowSize = resolveCssPx(root, "--_tt-arrow-size");
    const borderRadius = resolveCssPx(root, "--_tt-border-radius");
    /* Half the site padding, per the contract: "bubble stays at least half this
       value from each viewport edge". */
    const viewportInset = resolveCssPx(root, "--_tt-site-padding") / 2;

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      popupRect.width,
      window.innerWidth,
      viewportInset,
    );
    root.style.setProperty("--_tt-popup-offset", `${offset}%`);

    /* The offset above has not reached layout yet, so the bubble's left edge is
       computed arithmetically rather than re-measured — same as the reference. */
    const popupLeft =
      containerRect.left + (offset / 100) * containerRect.width - popupRect.width / 2;
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      popupLeft,
      popupRect.width,
      borderRadius,
      arrowSize,
    );
    root.style.setProperty("--_tt-arrow-offset", `${arrowOffset}px`);
  }, []);

  /* Mount: the reference computes direction in _init(), even while closed. */
  useLayoutEffect(() => {
    measureDirection();
  }, [measureDirection]);

  /* Open (and any direction change while open): measure and place. A layout
     effect, so the offsets land before the browser paints the open bubble —
     otherwise the first frame shows it at the `50%` CSS default. */
  useLayoutEffect(() => {
    if (open) updateLayout();
  }, [open, direction, updateLayout]);

  /* window resize — rAF-coalesced, exactly as the reference does it. Direction is
     recomputed even when closed; layout only when open. */
  useEffect(() => {
    const onResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        measureDirection();
        if (popupRef.current?.getAttribute("aria-hidden") === "false") updateLayout();
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [measureDirection, updateLayout]);

  /* Pointer light dismiss. A native `mousedown` listener on `document`, not a
     React handler: a React `onMouseDown` can only see events inside this
     subtree, which is the opposite of what "outside" means. Per ADR-0007 this
     path closes and does NOTHING else — no `trigger.focus()`, because
     refocusing on an outside click steals the user's click target and
     scroll-jumps the page. */
  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  /* focusout. React's `onBlur` IS `focusout` (it delegates the capture-phase
     native event and it bubbles), and `relatedTarget` survives the synthetic
     wrapper — so the reference's listener ports to a plain prop with no escape
     hatch. Covers Tab-away and programmatic focus moves alike. */
  const onRootBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (root && !root.contains(event.relatedTarget as Node | null)) setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    /* Direction is measured BEFORE the open render, so the bubble never paints
       on the wrong side. Both state updates batch into one commit. Deliberately
       not done inside a `setOpen` updater — an updater must stay pure, and
       StrictMode double-invokes it. */
    const root = rootRef.current;
    if (root) setDirection(detectDirection(root.getBoundingClientRect()));
    setOpen(true);
  }, [open]);

  return (
    <ToggleTipRoot
      ref={rootRef}
      /* Rendered markup is formed from the first paint, so the contract's
         `initialized` attribute is true on arrival. The CSS gate that used to
         read it is dropped (it clips the popup — F-010); the attribute stays
         because it is contract and a test target. */
      initialized=""
      icon={icon}
      data-id={dataId}
      data-direction={direction}
      className={className}
      onBlur={onRootBlur}
    >
      <button
        type="button"
        aria-label={label ?? DEFAULT_LABEL[icon]}
        aria-expanded={open}
        aria-controls={popupId}
        onClick={toggle}
      >
        <Icon icon={icon} />
      </button>
      <div className="rail" ref={railRef}>
        {/* `aria-hidden` is the one place the "true or absent" rule does not
            apply: the stylesheet keys `display` off BOTH values
            (`[aria-hidden="true"] { display: none }` /
            `[aria-hidden="false"] { display: block }`) and the suite asserts the
            literal string "false" when open. Absent would break both. */}
        <div
          className="popup"
          id={popupId}
          role="tooltip"
          aria-hidden={open ? "false" : "true"}
          ref={popupRef}
        >
          {heading ? (
            <span className="title" role="heading" aria-level={headingLevel}>
              {heading}
            </span>
          ) : null}
          {children}
          <div className="arrow" />
        </div>
      </div>
    </ToggleTipRoot>
  );
}
