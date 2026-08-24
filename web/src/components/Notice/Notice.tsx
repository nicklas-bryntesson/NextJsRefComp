/* Notice — React port of reference-components/src/partials/components/Notice.
 *
 * NO 'use client'. Notice.md is explicit: "No JavaScript." There is no
 * reference `Notice.ts` at all — the component directory holds only .css, .html,
 * .md and tests. Everything the component does is expressed by markup plus three
 * boolean `data-*` toggles, so the port is a pure Server Component and ships
 * zero client bytes. This is the contract's own ideal, not a shortcut.
 *
 * Structural class names are contractual — `.Notice`, `.icon`, `.content`,
 * `.title` are all selected by the verbatim stylesheet and by the conformance
 * suite (`#Notice .Notice[data-variant="…"] .icon`, `.Notice .icon svg`).
 * They are preserved exactly; Phase B layers utilities alongside them, never
 * instead of them. See Findings.md F-008.
 *
 * Booleans follow the library's rule: `="true"` or ABSENT, never `="false"`.
 * The single documented exception is `data-icon`, whose API value IS the string
 * "false" (`data-icon="false"` drops the icon); absent means "icon shown".
 */

import type { ReactNode } from "react";

/* The component owns its stylesheet — deletable in one move. */
import "./Notice.layered.css";

/** The documented severity set. `neutral` is the default; the CSS treats an
 *  absent `data-variant` and `data-variant="neutral"` identically, so we always
 *  author the attribute for an unambiguous DOM. */
export type NoticeVariant = "error" | "warning" | "success" | "info" | "neutral";

/* ── Icons ─────────────────────────────────────────────────────────────────
 * Inline stroke SVGs, byte-for-byte the paths the reference kitchensink
 * authors. Deliberately NOT a CSS mask/background: the mark is drawn with
 * `stroke: currentColor` and `.icon { color: var(--_nt-accent) }`, so it
 * re-tints with the variant and the component stays self-contained (Notice.md,
 * "Icons: inline SVG + currentColor").
 *
 * `aria-hidden="true"` sits on the <svg> itself, not only on a wrapper: the
 * conformance suite asserts `#Notice .Notice .icon svg` carries it. `focusable`
 * is the IE/legacy-Edge guard the reference keeps.
 */
const ICONS: Record<NoticeVariant, ReactNode> = {
  error: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  warning: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  success: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  neutral: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
};

export type NoticeProps = {
  /** Severity. Sets the accent (tint + icon + chrome) and picks the icon. */
  variant?: NoticeVariant;
  /** Optional bold `.title` (`<strong>`). Omit for a title-less message. */
  title?: ReactNode;
  /** The message body. A bare string is wrapped in a `<p>`; pass your own
   *  element(s) when the body needs more than one paragraph or inline markup. */
  children: ReactNode;
  /** `false` renders no icon and collapses the grid to one column. */
  icon?: boolean;
  /** A full border in the accent (icon) colour. */
  border?: boolean;
  /** The "styled" hook — a thick leading accent bar (the richest look). */
  emphasis?: boolean;
  /** Conformance / demo anchor. The suite family convention is `data-id`. */
  dataId?: string;
  /** Extra classes. Layered ALONGSIDE `.Notice`, never replacing it. */
  className?: string;
};

export function Notice({
  variant = "neutral",
  title,
  children,
  icon = true,
  border = false,
  emphasis = false,
  dataId,
  className,
}: NoticeProps) {
  /* Notice carries NO `role` and no `aria-live`. ADR-0016's separation of
     concerns is the whole point of the component: Notice is the payload, the
     persistent live region is the context's (see <NoticeRegion> below). The
     suite asserts `getAttribute('role')` is null on the first Notice. */
  return (
    <div
      className={
        /* PHASE B. `.Notice` is contractual and comes FIRST; utilities are
           layered alongside it, never instead of it (F-008). Every one of these
           replaced a declaration in Notice.css — see that file's header for the
           value/derivation split that decided what could move.
           The three `data-[…]:` variants are the interesting result: Tailwind
           expresses the library's own data-attribute state API directly, so the
           toggles did not need a stylesheet at all. */
        [
          "Notice",
          "grid grid-cols-[auto_1fr] gap-x-base p-base max-w-[50rem]",
          /* 0.75rem, not the reference's 0.375rem: cursor-DESIGN.md gives
             --radius-lg to "cards, panes, popovers". A visible change, recorded. */
          "rounded-lg",
          /* `data-icon="false"` collapses the grid to one column. */
          "data-[icon=false]:grid-cols-[1fr]",
          /* A full border in the accent colour. The WIDTH is a value (utility);
             the COLOUR is `--_nt-accent`, resolved per variant by the stylesheet. */
          "data-[border=true]:border data-[border=true]:border-[color:var(--_nt-accent)]",
          /* The emphasis bar: 0.25rem inline-start, same accent. */
          "data-[emphasis=true]:border-s-4 data-[emphasis=true]:border-s-[color:var(--_nt-accent)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
      data-variant={variant}
      /* The one attribute whose API value is the literal string "false". */
      data-icon={icon ? undefined : "false"}
      data-border={border ? "true" : undefined}
      data-emphasis={emphasis ? "true" : undefined}
      data-id={dataId}
    >
      {icon && (
        <div className="icon flex items-start" aria-hidden="true">
          <svg
            className="block w-6 h-6"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            {ICONS[variant]}
          </svg>
        </div>
      )}
      <div className="content flex min-w-0 flex-col gap-xxs">
        {title != null && <strong className="title font-semibold">{title}</strong>}
        {typeof children === "string" ? <p>{children}</p> : children}
      </div>
    </div>
  );
}

/* ── The announcer ─────────────────────────────────────────────────────────
 * A separate, persistent container — present and EMPTY at load — into which a
 * host swaps Notice content. `role="alert"`/`aria-live` announce a change
 * *inside a region that already exists*; a freshly-injected pre-filled alert is
 * not reliably announced (Notice.md, "Announcing").
 *
 * Politeness follows severity: error/warning → alert/assertive,
 * success/info/neutral → status/polite.
 *
 * This is a Server Component too. Making the region persistent in React is a
 * one-liner the reference has to hand-roll (`replaceChildren()` → rAF →
 * `append()`): render the region unconditionally and put the Notice in state.
 * React's keyed reconciliation performs the clear-then-set mutation for you.
 */
export function NoticeRegion({
  politeness = "assertive",
  children,
  dataId,
  className,
}: {
  politeness?: "assertive" | "polite";
  children?: ReactNode;
  dataId?: string;
  className?: string;
}) {
  return (
    <div
      className={className ? `notice-region ${className}` : "notice-region"}
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      data-id={dataId}
    >
      {children}
    </div>
  );
}

export default Notice;
