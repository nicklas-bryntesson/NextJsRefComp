/* Shared kitchensink chrome. Every component's <Name>.kitchensink.tsx composes
 * these, so the demo pages stay consistent and a port never has to re-invent
 * the layout.
 *
 * ONE thing here is test contract rather than styling: the `.kitchensink-section`
 * class on <Section>. Several suites scope their full-section axe run to
 * `.kitchensink-section:has([data-id="<component>-live"])` — a class name from the
 * reference's own demo page that no component contract mentions. Do not rename
 * it. See Findings.md F-014.
 *
 * The reference kitchensink pattern (CLAUDE.md in the submodule) is:
 *   1. Interaction states — default / hover / focus / active × empty / filled
 *   2. Disabled       — its own block. Disabled is a FUNCTIONAL state:
 *                       pointer-events: none makes hover impossible, so it never
 *                       gets interaction columns.
 *   3. Invalid        — its own block
 *   4. Variants       — component-specific configurations
 *   5. Live demo      — the real interactive instance the e2e target points at
 *   6. Native reference — the browser's built-in control, for comparison
 */

import type { ReactNode } from "react";

export function Section({
  id,
  title,
  anchorId,
  children,
}: {
  /** Used for the heading id. Not the e2e anchor — that is `data-id` on the component. */
  id: string;
  title: string;
  /** Some suites scope an unscoped `checkA11y(page, '#<Component>')` to the id of
   *  the reference *demo section* — e.g. ChoiceField uses `#ChoiceField`. That id
   *  is not documented anywhere and no component contract mentions it; a port
   *  discovers it by watching axe run against a null scope. Pass it here.
   *  See Findings.md F-018. */
  anchorId?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={anchorId}
      className="kitchensink-section mb-section"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="mb-lg text-display-md text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-xl">
      {/* `text-body`, not `text-muted`. The design doc lists `muted` (#807d72) for
          sub-titles, but at 3.84:1 on the cream canvas it fails AA for normal
          text — and an unscoped axe run over a whole kitchensink section catches
          it. See Findings.md F-017. */}
      <h3 className="mb-base text-caption-uppercase uppercase text-body">{title}</h3>
      <div className="flex flex-wrap items-end gap-lg rounded-lg border border-hairline bg-surface-card p-lg">
        {children}
      </div>
    </div>
  );
}

/** One state cell: a caption naming the state, then the component's own
 *  label + control. The `[&>label]` rules style the label the component renders
 *  without the component having to know about our type scale. */
export function Cell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    /* `min-w-0` on the cell is load-bearing for WCAG 1.4.10 Reflow.
     *
     * A grid/flex item defaults to `min-width: auto`, so a fixed-width demo
     * inside a Cell SIZES THE AUTO TRACK IT SITS IN — which makes `max-w-full`
     * useless, because `100%` then resolves against the item's own fixed width
     * rather than the viewport. The MotionRegion port measured the consequence:
     * 169 px of document horizontal scroll at a 320 px viewport, which is a
     * 1.4.10 failure, and axe does not test reflow at all so every green audit
     * coexisted with it. `min-w-0` lets the track shrink, so a component can use
     * a plain `w-[28rem] max-w-full` and get reflow for free.
     *
     * Verify with `web/tasks/probes/reflow-sweep.cjs` — it sweeps the viewport
     * and is the only instrument that catches this. See Findings.md F-024. */
    <div className="grid min-w-0 gap-xxs">
      {/* NOT `text-muted-soft`. That token is 2.73:1 and `design-tokens.css`
          marks it "disabled text only (WCAG 1.4.3 inactive exception)" — a live
          state caption gets no exception. F-017. */}
      <span className="text-caption text-body">{caption}</span>
      {/* `min-w-0` on the INNER div too, not just the outer. `Cell` renders two
          nested grids, and a grid item defaults to `min-width: auto`, so putting
          it on the outer one alone leaves the inner track unshrinkable — the
          outer box measured 238px while its own `grid-template-columns` computed
          to 281px, and a FileUpload row overflowed the document by 2px at 320px.
          Reported by the RangeScale port ("Cell renders two nested divs and only
          the outer carries min-w-0"); acted on here.

          And `min-w-0` alone was not enough, which is the subtler half: it sets
          `min-width` on the div as a grid ITEM of the outer grid, but the div is
          also a grid CONTAINER, and its own track was still sized to its
          content's max-content (measured: box 238px, own
          `grid-template-columns` 281.109px). A track wider than its box
          overflows regardless of the box's min-width. So the track itself has to
          be bound: `minmax(0, 1fr)`. F-024. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-xxs [&>label]:text-body-sm [&>label]:text-body">{children}</div>
    </div>
  );
}

/** Page shell for both the aggregate kitchen sink and the per-component routes. */
export function KitchensinkPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-content px-base py-section">
      <header className="mb-section">
        <h1 className="text-display-lg text-ink">{title}</h1>
        {intro && <p className="mt-sm max-w-[60ch] text-body-md">{intro}</p>}
      </header>
      {children}
    </main>
  );
}
