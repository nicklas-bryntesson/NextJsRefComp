"use client";

/* RangeGroup — React port of reference-components/src/partials/components/RangeGroup.
 *
 * Two RangeFields on one shared RangeScale, bounding a span. Native range has no
 * `multiple`, so a span is two inputs, and this component owns exactly the three
 * rules that are about the PAIR (ADR-0023):
 *
 *   1. CLAMPING — hard stop. The VALUE is clamped; `min`/`max` are left alone,
 *      because changing an attribute shrinks that input's own travel and the two
 *      stop sharing a coordinate system.
 *   2. THE EXPOSED SPAN — `aria-valuemax` on the lower end, `aria-valuemin` on
 *      the upper, plus `aria-valuetext` carrying the same fact in words (the half
 *      that is honoured everywhere).
 *   3. POINTER ARBITRATION — the nearer thumb is raised, on `pointermove` as well
 *      as `pointerdown`, and on equal values the tie is broken by SIDE.
 *
 * WHY THE LANE IS INLINED HERE RATHER THAN COMPOSED FROM <RangeScale>
 * -------------------------------------------------------------------
 * In the reference, the lane is *authored markup* and `RangeScale.ts` merely
 * attaches behaviour to `[data-component="RangeScale"]`. So "one lane, one field
 * or two" costs the reference nothing: RangeGroup's own .hbs partials write the
 * `.RangeScale` div, the `.track` and the `.fill` by hand, exactly as reproduced
 * below. A React `<RangeScale>` component instead *owns* its children, and the
 * port's signature is `{ id, label, defaultValue }` — one input, one label, one
 * readout. It cannot hold a pair, and it is not mine to change.
 *
 * So the lane markup is written here, and `RangeScale.css` is imported as the
 * composition seam (read, never edited). The one thing that has to be duplicated
 * is the lane's *publication* of `--_rs-a` / `--_rs-b` / `--_rs-p`, because in
 * React that lives inside the sibling component's effect rather than in a
 * DOM-scanning `attach()`. `__rangeScaleInstance` is installed on the lane
 * element for the same reason the suite asks for it. See findings/RangeGroup.md.
 *
 * WHY THE LISTENERS ARE NATIVE, AND THE INPUTS UNCONTROLLED
 * ---------------------------------------------------------
 * Both React traps this family sets meet here too:
 *   - `value={n}` without `onChange` freezes a native range while still reporting
 *     `role="slider"` — it fails as an apparent native-semantics defect.
 *   - React's synthetic `onChange` is *deduplicated* against its own tracked
 *     value, so `field.value = '1000'; field.dispatchEvent(new Event('input'))`
 *     — the exact sequence two of these tests use — is swallowed. A plain
 *     `addEventListener('input', …)` sits outside React's event system and sees
 *     every one.
 * So the values stay the browser's, and the announcement, the readouts and the
 * exposed span are written imperatively by the same lines the reference uses.
 * React still owns the FIRST PAINT: `--_rs-a`/`--_rs-b`, the digit reservation
 * and both readouts are server-rendered from the props.
 *
 * Class names (`.RangeGroup`, `.roles`, `.RangeScale`, `.track`, `.fill`,
 * `.RangeField`, `.digits`) and `data-readout` / `data-role` / `data-fields` are
 * all contract. See Findings.md F-008.
 */

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

import "./RangeGroup.layered.css";
/* The lane draws; its stylesheet is the composition seam made explicit. */
import "../RangeScale/RangeScale.css";
import "../RangeField/RangeField.css";
import { rangeGroupAttach, rangeGroupBootstrapSource } from "./RangeGroup.bootstrap";

type GroupElement = HTMLFieldSetElement & { __rangeGroupInstance?: { sync: () => void } };

type StyleVars = CSSProperties & Record<`--${string}`, string | number>;

/** A tick stop: normalised position plus the numeric label authored in the DOM.
 *  Words would be a different component (ADR-0024). */
export type RangeGroupStop = { p: number; label: string };

export type RangeGroupProps = {
  /** Both field ids derive from it: `<id>-lower` / `<id>-upper`. */
  id: string;
  /** `<legend>` — the group's INTRINSIC name. No id plumbing. */
  legend: ReactNode;
  /** What each end *is*. A span is not one value with two handles, so a single
   *  label for the pair would leave one end unnamed. */
  lowerLabel?: ReactNode;
  upperLabel?: ReactNode;

  min?: number;
  max?: number;
  step?: number;
  defaultLower?: number;
  defaultUpper?: number;

  /** The unit, on both readouts. `data-suffix` carries it; the digits carry the
   *  number. Anything locale-sensitive is the host's `Intl.NumberFormat`. */
  suffix?: string;

  /** Native cascades it from the `<fieldset>` to both fields. */
  disabled?: boolean;
  /** `data-invalid` on the lane (it draws the track) AND on both fields (they
   *  draw the thumbs); `aria-invalid` on the controls. */
  invalid?: boolean;

  lane?: "inset" | "flush";
  ticks?: "marks" | "labels";
  stops?: RangeGroupStop[];

  /** Kitchensink only — a statically projected pseudo-class on both fields. */
  testState?: "hover" | "focus" | "active";
  dataId?: string;

  /** Override for an unusual number format (a thousands separator adds
   *  characters). Default: the widest of `min` / `max` as written. */
  readoutDigits?: number;
};

function normalise(value: number, min: number, max: number): number {
  const span = max - min;
  return span === 0 ? 0 : (value - min) / span;
}

export function RangeGroup({
  id,
  legend,
  lowerLabel = "Lowest",
  upperLabel = "Highest",
  min = 0,
  max = 100,
  step = 1,
  defaultLower = min,
  defaultUpper = max,
  suffix,
  disabled,
  invalid,
  lane,
  ticks,
  stops,
  testState,
  dataId,
  readoutDigits,
}: RangeGroupProps) {
  const rootRef = useRef<GroupElement>(null);

  const lowerId = `${id}-lower`;
  const upperId = `${id}-upper`;

  /* SAFETY NET ONLY. The behaviour is attached by the inline bootstrap script
     (see RangeGroup.bootstrap.ts for the measurement that forced it there), which
     runs while the HTML is still being parsed. `rangeGroupAttach` is idempotent —
     `__rangeGroupInstance` is the guard, exactly as the reference's `attach()`
     guards on it — so on a fresh document this is a no-op. It exists for anything
     mounted after the initial parse: a client navigation, a conditionally
     rendered group, a Strict-Mode remount. */
  useEffect(() => {
    rangeGroupAttach();
  }, []);

  /* Room for the widest NUMBER the readouts can show, taken from the contract
     and never measured from the DOM — the same idea as AffixField's
     --_af-input-chars. DIGITS ONLY: reserving the whole string over-reserved by
     about a quarter, because a space and three lowercase letters are far
     narrower than a zero. */
  const digits = readoutDigits ?? Math.max(String(min).length, String(max).length);

  const groupStyle: StyleVars = { "--_rg-readout-digits": digits };

  /* Server-rendered so the first paint is correct without JavaScript. */
  const laneStyle: StyleVars = {
    "--_rs-a": normalise(Math.min(defaultLower, defaultUpper), min, max),
    "--_rs-b": normalise(Math.max(defaultLower, defaultUpper), min, max),
    "--_rs-p": normalise(defaultUpper, min, max),
  };

  const readout = (side: "lower" | "upper", value: number) => (
    <b data-readout={side} data-suffix={suffix}>
      <span className="digits">{value}</span>
      {suffix ? ` ${suffix}` : ""}
    </b>
  );

  /* The span, server-rendered. `RangeGroup.md` forbids AUTHORING these — "a
     second source of truth that goes stale on the first drag" — and that is
     right for a hand-written HTML file. Here they are derived from the same two
     props `wire()` derives them from, in the same render, so there is exactly one
     source of truth; and rendering them means the announcement is correct before
     any script runs AND that hydration finds the attributes it expects, with no
     mismatch to patch. See findings/RangeGroup.md. */
  const lo = Math.min(defaultLower, defaultUpper);
  const hi = Math.max(defaultLower, defaultUpper);
  const spanText = suffix ? `${lo}–${hi} ${suffix}` : `${lo}–${hi}`;
  const valueText = (value: number) =>
    `${suffix ? `${value} ${suffix}` : value}, within ${spanText}`;

  const field = (side: "lower" | "upper", fieldId: string, value: number) => (
    <input
      className="RangeField"
      type="range"
      id={fieldId}
      name={fieldId}
      data-role={side}
      min={min}
      max={max}
      step={step}
      defaultValue={value}
      aria-valuemax={side === "lower" ? defaultUpper : undefined}
      aria-valuemin={side === "upper" ? defaultLower : undefined}
      aria-valuetext={valueText(value)}
      aria-invalid={invalid ? "true" : undefined}
      data-invalid={invalid ? "true" : undefined}
      data-test-state={testState}
    />
  );

  return (
    <fieldset
      ref={rootRef}
      className="RangeGroup"
      data-component="RangeGroup"
      data-id={dataId}
      disabled={disabled}
      style={groupStyle}
    >
      {/* Spec requirement AND the only intrinsic group name: <legend> is the
          first child of <fieldset>. No aria-label, no aria-labelledby. */}
      <legend>{legend}</legend>

      <div className="roles">
        <label htmlFor={lowerId}>
          {lowerLabel} {readout("lower", defaultLower)}
        </label>
        <label htmlFor={upperId}>
          {upperLabel} {readout("upper", defaultUpper)}
        </label>
      </div>

      {/* `data-fields="2"` is an AUTHORED fact, not a `:has()` reading of the
          DOM. The pointer rule hanging off it is load-bearing — without it the
          topmost input swallows every click and the lower thumb can never be
          grabbed — and load-bearing selectors do not get to depend on feature
          detection (ADR-0005). */}
      <div
        className="RangeScale"
        data-component="RangeScale"
        data-fields="2"
        data-lane={lane}
        data-ticks={ticks}
        data-invalid={invalid ? "true" : undefined}
        style={laneStyle}
      >
        <span className="track" />
        <span className="fill" />
        {field("lower", lowerId, defaultLower)}
        {field("upper", upperId, defaultUpper)}
        {/* Nothing in ARIA models tick marks, and `step` already makes the
            keyboard land on exactly these stops, so both channels agree with no
            ARIA at all. */}
        {stops ? (
          <span className="ticks" aria-hidden="true">
            {stops.map((stop) => (
              <i key={stop.p} style={{ "--p": stop.p } as StyleVars}>
                <span>{stop.label}</span>
              </i>
            ))}
          </span>
        ) : null}
      </div>
    </fieldset>
  );
}

export default RangeGroup;

/* The inline bootstrap. Rendered ONCE per page — a real consumer would put this
 * in its root layout, exactly as it would a theme script; the kitchensink renders
 * it at the top of the RangeGroup section.
 *
 * It has to be an inline, parser-blocking `<script>`: every Next.js client chunk
 * is injected with `async`, which does not delay the `load` event, so no imported
 * module can run before a navigation is considered complete. See
 * RangeGroup.bootstrap.ts for the measurements. `suppressHydrationWarning` is not
 * needed — the script writes only values the server already rendered.
 */
export function RangeGroupBootstrap() {
  return <script dangerouslySetInnerHTML={{ __html: rangeGroupBootstrapSource() }} />;
}
