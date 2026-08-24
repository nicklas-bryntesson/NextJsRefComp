/* CircleDiagram.tsx — port of `Views/Partials/richtext/Components/rteCircleDiagramBlock.cshtml`.
 *
 * THERE IS NO TAGHELPER. The markup contract was derived, but for this one the
 * derivation cost nothing: the Razor partial is a complete, literal template
 * with every class name and every element spelled out, so the contract is as
 * explicit here as the C# was for the Button family — it just lives in a `.cshtml`
 * instead of a `.cs`. Confidence: HIGH. See findings/primitives-orphans.md F-064.
 *
 * The one thing the source computes and we reproduce exactly is the conic
 * gradient: segments become `var(--CircleDiagram-color-N) START% END%` stops on
 * an inline `style`, cumulative, N being a 1-based index. That is the only
 * "logic" in the component and it is pure arithmetic, so this stays a Server
 * Component with no `'use client'`.
 *
 * Percentages come from integer `value`s summed to a total, exactly as the
 * Razor does. A total of 0 renders nothing (the source `return`s).
 */

import "./CircleDiagram.css";

/* STEP 3 — Tailwind conversion.
 *
 * WHAT MOVED: the LEAF styling. Type, colour, gap, flex and the swatch box are
 * utilities now, layered ALONGSIDE every original class name — `CircleDiagram`,
 * `-chart`, `-center`, `-caption`, `-title`, `-subtitle`, `-legend`,
 * `-legend-item`, `-legend-swatch`, `-legend-label`, `-legend-value`. Not one is
 * dropped. They are the only selector surface this component has (there is no
 * TagHelper and no `data-*` API), so they are contractual by default rather than
 * by a spec that happens to select on them.
 *
 * WHAT STAYED IN CSS, and why it is not laziness:
 *  · the six `--CircleDiagram-color-N` custom properties — the override seam. A
 *    utility cannot be reassigned by a host in one scoped rule; the property can.
 *    F-062 is the whole argument.
 *  · `conic-gradient` from an inline `style` — it is computed per instance.
 *  · `container-type` + `@container (min-width: 30rem)` + the `@supports not`
 *    viewport fallback. Tailwind v4 has `@container`/`@max-*` variants but no
 *    variant for "`@supports not (container-type)` around a viewport media query",
 *    and expressing the fallback would mean two utility sets whose relationship
 *    is invisible at the call site. Progressive enhancement is a STRUCTURE, and
 *    utilities have no way to say it.
 *  · `figure { margin-inline: 0 }` — a UA-default reset on an element selector.
 *    There is no element to hang a utility on that the source's markup guarantees.
 *
 * So the boundary is not "small things move and big things stay": it is that a
 * utility can express a VALUE and cannot express a CONDITION whose two halves
 * must be linked. F-096.
 */

/* Kept as named constants rather than inlined at each site, so the class list at
 * the JSX site stays readable and a change lands in one place — which is the
 * `@apply`-shaped need Tailwind v4 deliberately does not serve. */
/* `gap-xxs`, NOT `gap-xs`. The source reads `var(--size-xs, 0.5rem)` and the
 * bridge maps `--size-xs` to `--spacing-xxs` = 4px, so the inline fallback
 * `0.5rem` never applies and the real gap is 4px. A naming collision between the
 * two scales this port straddles; the computed-style diff caught it as 52 nodes
 * of `gap: 4px -> 8px`. F-097. */
const LEGEND = "flex list-none flex-col gap-xxs p-0 m-0";
/* `leading-normal` is REQUIRED, and it is the whole lesson of this conversion.
 * Step 2 set `font-size` alone and let `line-height` inherit 1.5 from the page.
 * Tailwind's `text-caption` is a PAIR — `--text-caption` plus
 * `--text-caption--line-height: 1.4` — so a utility that reads like a font-size
 * silently changed the line box from 19.5px to 18.2px on 440 nodes. A `font-size`
 * declaration and a `text-*` utility are not the same thing. F-097. */
const LEGEND_ITEM =
  "flex flex-wrap items-center gap-xs font-sans text-caption leading-normal";
const SWATCH = "size-3 shrink-0 rounded-xs border border-hairline";
const LABEL = "min-w-0 flex-1 break-words text-ink";
const VALUE = "shrink-0 tabular-nums text-body";

/* Two more utilities that are NOT equivalent to the declaration they replaced,
 * both caught by the diff rather than by eye:
 *  · `rounded-full` computes to 9999px; the source said `50%`. On a square box
 *    they draw the same circle, so the difference is invisible until the box
 *    stops being square — 52 nodes read `50% -> 3.35544e+07px`. `rounded-[50%]`.
 *  · `text-title-md` carries `line-height: 1.4` and no tracking, while step 2
 *    used the bridge's heading metrics (1.25 / -0.0125em). Restated explicitly
 *    as `leading-[1.25] tracking-[-0.0125em]` or 22 nodes move 22.5px -> 25.2px.
 * F-097. */

export type CircleDiagramSegment = {
  label: string;
  value: number;
};

export type CircleDiagramProps = {
  title?: string;
  subtitle?: string;
  segments: CircleDiagramSegment[];
  /** Source has no such attribute. See F-067 — the chart is `aria-hidden` and
   *  the legend carries the data as text, so a caption is the only place a
   *  screen-reader user learns what the figure *is*. Defaults to `title`. */
  accessibleName?: string;
};

/** How many `--CircleDiagram-color-N` custom properties the stylesheet defines. */
const PALETTE_SIZE = 6;

/** Matches the Razor's `@seg.Percentage.ToString("0.#")` and `{v:0.##}`. */
function fixed(value: number, places: 1 | 2): string {
  return String(Number(value.toFixed(places)));
}

export function CircleDiagram({
  title,
  subtitle,
  segments,
  accessibleName,
}: CircleDiagramProps) {
  if (segments.length === 0) return null;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  /* NO ACCUMULATOR. The obvious way to lay out a conic gradient is
   * `let cumulative = 0` and `cumulative += percentage` in a `map` — the
   * idiomatic charting loop, and how the Razor does it. `react-hooks/immutability`
   * rejects it: "Cannot reassign variable after render completes". So the running
   * total is derived instead of mutated: each segment's start angle is the sum of
   * every value BEFORE it, computed from the array rather than carried in a
   * closure variable. Same output, O(n^2) on a list that is at most a handful of
   * segments. F-089.
   */
  const cumulativeBefore = segments.reduce<number[]>(
    (acc, segment, i) => [...acc, (acc[i] ?? 0) + segment.value],
    [0],
  );

  const computed = segments.map((segment, i) => {
    const percentage = (segment.value / total) * 100;
    const start = (cumulativeBefore[i] / total) * 100;
    const end = (cumulativeBefore[i + 1] / total) * 100;
    /* STEP 2 FIX. The source indexes the palette by raw segment ordinal, and the
       palette has six entries — so a seventh segment emitted
       `var(--CircleDiagram-color-7)`, which resolves to nothing, which makes that
       conic-gradient stop invalid, which invalidates the WHOLE gradient and
       renders the chart BLANK. One extra segment in the CMS and the graphic
       disappears. Wrapping the index degrades to a repeated colour instead,
       which is survivable precisely because the legend carries the data as text
       (see the stylesheet header). F-074. */
    const paletteIndex = (i % PALETTE_SIZE) + 1;
    return {
      ...segment,
      index: i + 1,
      paletteIndex,
      percentage,
      stop: `var(--CircleDiagram-color-${paletteIndex}) ${fixed(start, 2)}% ${fixed(end, 2)}%`,
    };
  });

  const gradient = `conic-gradient(${computed.map((s) => s.stop).join(", ")})`;
  const label = accessibleName ?? title;

  return (
    <figure
      className="CircleDiagram m-0 flex max-w-full flex-col items-start gap-sm my-sm"
      role="group"
      aria-label={label}
    >
      {/* `aria-hidden` is a PORT ADDITION and the a11y crux of this component.
          The chart is a `<div>` whose only content is a background gradient: it
          carries the whole dataset visually and exposes literally nothing to
          assistive tech. The source leaves it in the accessibility tree as two
          empty generic containers. Hiding it and letting the legend — which
          already renders label AND percentage as text — be the accessible
          representation is the only option that does not invent a data table
          the source never had. F-067. */}
      <div
        className="CircleDiagram-chart relative aspect-square h-auto max-w-full shrink rounded-[50%]"
        aria-hidden="true"
        style={{ background: gradient }}
      >
        <div className="CircleDiagram-center absolute rounded-[50%] bg-surface-card" />
      </div>

      <figcaption className="CircleDiagram-caption flex min-w-0 flex-1 flex-col gap-xxs">
        {/* Source renders `<app-heading element="h4" size="4">`. The Heading
            TagHelper is not in this port's scope, so the element and the type
            role it resolves to are reproduced directly. A fixed `h4` is the
            source's own choice and it is a heading-order hazard the source
            already had — recorded, not fixed, because fixing it means adding an
            attribute the contract does not have. F-068. */}
        {title ? (
          <h4 className="CircleDiagram-title m-0 font-sans text-title-md font-semibold leading-[1.25] tracking-[-0.0125em] text-ink">
            {title}
          </h4>
        ) : null}
        {subtitle ? (
          <p className="CircleDiagram-subtitle m-0 font-sans text-body-sm text-body">
            {subtitle}
          </p>
        ) : null}

        <ul className={`CircleDiagram-legend ${LEGEND}`}>
          {computed.map((segment) => (
            <li
              className={`CircleDiagram-legend-item ${LEGEND_ITEM}`}
              key={`${segment.index}-${segment.label}`}
            >
              <span
                className={`CircleDiagram-legend-swatch ${SWATCH}`}
                aria-hidden="true"
                style={{
                  background: `var(--CircleDiagram-color-${segment.paletteIndex})`,
                }}
              />
              <span className={`CircleDiagram-legend-label ${LABEL}`}>
                {segment.label}
              </span>
              <span className={`CircleDiagram-legend-value ${VALUE}`}>
                {fixed(segment.percentage, 1)}%
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
