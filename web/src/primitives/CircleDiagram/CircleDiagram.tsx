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
    <figure className="CircleDiagram" role="group" aria-label={label}>
      {/* `aria-hidden` is a PORT ADDITION and the a11y crux of this component.
          The chart is a `<div>` whose only content is a background gradient: it
          carries the whole dataset visually and exposes literally nothing to
          assistive tech. The source leaves it in the accessibility tree as two
          empty generic containers. Hiding it and letting the legend — which
          already renders label AND percentage as text — be the accessible
          representation is the only option that does not invent a data table
          the source never had. F-067. */}
      <div className="CircleDiagram-chart" aria-hidden="true" style={{ background: gradient }}>
        <div className="CircleDiagram-center" />
      </div>

      <figcaption className="CircleDiagram-caption">
        {/* Source renders `<app-heading element="h4" size="4">`. The Heading
            TagHelper is not in this port's scope, so the element and the type
            role it resolves to are reproduced directly. A fixed `h4` is the
            source's own choice and it is a heading-order hazard the source
            already had — recorded, not fixed, because fixing it means adding an
            attribute the contract does not have. F-068. */}
        {title ? <h4 className="CircleDiagram-title">{title}</h4> : null}
        {subtitle ? <p className="CircleDiagram-subtitle">{subtitle}</p> : null}

        <ul className="CircleDiagram-legend">
          {computed.map((segment) => (
            <li className="CircleDiagram-legend-item" key={`${segment.index}-${segment.label}`}>
              <span
                className="CircleDiagram-legend-swatch"
                aria-hidden="true"
                style={{ background: `var(--CircleDiagram-color-${segment.paletteIndex})` }}
              />
              <span className="CircleDiagram-legend-label">{segment.label}</span>
              <span className="CircleDiagram-legend-value">{fixed(segment.percentage, 1)}%</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
