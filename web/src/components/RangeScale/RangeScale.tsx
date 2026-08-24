"use client";

/* RangeScale — React port of reference-components/src/partials/components/RangeScale.
 *
 * The lane a RangeField is measured against. This is the only tier in the range
 * family with JavaScript, and it has it for exactly one reason: CSS cannot read
 * an input's `value`, so anything whose length depends on that value has to be
 * told. The component writes the normalised position onto ITSELF, where it
 * inherits down into every layer.
 *
 * WHY THE INPUT IS UNCONTROLLED, AND WHY THE LISTENER IS NATIVE
 * -------------------------------------------------------------
 * Two independent React traps meet on this component, and both fail as apparent
 * *native-semantics* defects rather than as React bugs:
 *
 * 1. `value={n}` without `onChange` freezes a native range. The arrows, Home/End
 *    and PageUp/Down all still fire, `role="slider"` is still reported, and the
 *    value simply never moves — so the suite says "dragging syncs the fill" and
 *    points at nothing. `defaultValue` keeps the browser as the owner of the
 *    value, which is also what the contract asks for ("the browser positions the
 *    thumb").
 *
 * 2. React's synthetic `onChange` is *deduplicated*. React installs its own
 *    `value` property descriptor on every input it renders and suppresses the
 *    change event when the tracked value already equals `node.value`. The suite
 *    drives seven of its assertions with
 *        f.value = '100'; f.dispatchEvent(new Event('input', { bubbles: true }))
 *    which is exactly the sequence that descriptor swallows. A plain
 *    `addEventListener('input', …)` on the DOM node is outside React's event
 *    system and sees every one of them — including the synthesised ones.
 *
 * So the position, the readout text and `aria-valuetext` are written
 * IMPERATIVELY, by the same three lines the reference writes them with. React
 * still owns the *first paint*: `--_rs-p`, the digit reservation, the readout
 * text and `aria-valuetext` are all server-rendered from `defaultValue`, so the
 * lane is correct before any JavaScript runs (the reference has to do that pass
 * in `attach()`; here it is free).
 *
 * `__rangeScaleInstance` is part of the contract, not an escape hatch: the suite
 * calls `lane.__rangeScaleInstance.sync()` to prove the documented cure for a
 * programmatic `field.value = 80`, and it reads the computed style on the very
 * next line — so `sync()` has to be synchronous, which rules out React state.
 *
 * WHY `attach()` IS A MODULE FUNCTION AND NOT ONLY AN EFFECT
 * ---------------------------------------------------------
 * The reference mounts from `RangeScale.attach(parent?)`, called by a parse-time
 * module script, so the public API exists the moment the element does. A React
 * effect runs after hydration, and hydration in Next 16 / React 19 finishes
 * AFTER the window `load` event — measured on the aggregate page: load at 93 ms,
 * instance attached at 109 ms in a production build (235 ms / 386 ms in dev).
 * Playwright's `page.goto()` resolves on `load`, so a spec that reads
 * `lane.__rangeScaleInstance` immediately afterwards finds `undefined`. That is
 * not a slow dev server; it is a structural gap between "the DOM is here" and
 * "React has adopted it".
 *
 * So `attach()` is ported as what the contract says it is — a module-level
 * function with the reference's own idempotence guard — and called once at
 * client-module evaluation time, which happens BEFORE hydration. The effect then
 * only guarantees attachment for a lane React mounts later, and owns teardown.
 * Both paths run the same code and the guard makes the second one a no-op.
 *
 * Class names (`.track`, `.fill`, `.reference`, `.ticks`, `.value`, `.digits`,
 * `.hint`, `.swatch`, `.RangeField`) are contractual: this spec selects on 33 of
 * them. See Findings.md F-008.
 */

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

import "./RangeScale.layered.css";
/* The lane composes a RangeField (ADR-0023) and the geometry the suite measures
 * — half a thumb of inset, the input at the track's width — comes from that
 * component's stylesheet. Importing it is the composition seam made explicit;
 * the file is read, never edited. */
import "../RangeField/RangeField.css";

/** A tick stop: its normalised position and the numeric label authored in the
 *  DOM. Labels here are NUMERIC — a scale of words is a different component
 *  (ADR-0024), because its value only *stands for* a meaning. */
export type RangeScaleStop = { p: number; label: string };

type RangeScaleInstance = {
  sync: () => void;
  readonly value: number;
  readonly position: number;
  destroy: () => void;
};

type LaneElement = HTMLDivElement & { __rangeScaleInstance?: RangeScaleInstance };

/** Custom properties are not in `CSSProperties`; this keeps them typed without
 *  an `as CSSProperties` cast losing the rest of the object. */
type StyleVars = CSSProperties & Record<`--${string}`, string | number>;

export type RangeScaleProps = {
  id: string;
  label: ReactNode;
  name?: string;

  min?: number;
  max?: number;
  step?: number;
  /** Uncontrolled on purpose — see the header note. */
  defaultValue?: number;

  disabled?: boolean;
  /** `data-invalid` goes on BOTH the lane (it draws the track) and the field (it
   *  draws the thumb); `aria-invalid` goes on the control, which is the field. */
  invalid?: boolean;

  /** The `<output>`'s presence is the switch — there is no attribute, because a
   *  state that cannot be authored cannot be wrong. Default: it is rendered. */
  output?: boolean;
  /** The unit. Emitted as `data-suffix` on the LANE (the general form, which
   *  works with no readout at all) and on the output. A convenience for simple
   *  cases; anything locale-sensitive is the host's `Intl.NumberFormat`. */
  suffix?: string;
  /** An authored `aria-valuetext` for a lane with NO readout AND NO suffix. The
   *  lane mirrors whenever the unit is knowable; with neither source, the value
   *  is the host's and overwriting it would be a regression, not a sync. */
  valueText?: string;

  lane?: "inset" | "flush";
  /** Absent draws nothing. `marks` renders the stops, `labels` adds their text —
   *  same markup either way. */
  ticks?: "marks" | "labels";
  stops?: RangeScaleStop[];
  /** `none` — a lane whose value is not drawn as a filled portion. */
  fill?: "none";

  orientation?: "horizontal" | "vertical";
  /** Vertical only: which end the fill is anchored in. Mirrors the field's. */
  minPosition?: "top";

  reference?: "region" | "band" | "marker";
  referenceVariant?: "error" | "warning" | "success" | "info";
  /** Override only; the default follows the form, because the wrong one is
   *  invisible in the worst case. */
  referenceLayer?: "under" | "over" | "outside";
  referenceFrom?: number;
  referenceTo?: number;
  /** Colour is never the only carrier (WCAG 1.4.1). The hint lives INSIDE the
   *  lane so its swatch inherits `--_rs-ref-ink` and cannot drift. */
  hint?: ReactNode;

  /** Kitchensink only — a statically projected pseudo-class on the field. */
  testState?: "hover" | "focus" | "active";
  dataId?: string;
  /** The documented CSS Variable API (`--_rs-inset`, `--_rs-thumb`, …) plus
   *  `font-size`. Merged AFTER the derived properties, never replacing them. */
  styleOverrides?: CSSProperties;
};

/** The one conversion. A zero span has no position to express, so it clamps
 *  rather than dividing by zero. */
function normalise(value: number, min: number, max: number): number {
  const span = max - min;
  return span === 0 ? 0 : (value - min) / span;
}

/** Mount one lane. Idempotent — the reference's own guard, and the reason the
 *  module-level attach and the effect can both run. */
function mount(root: LaneElement): RangeScaleInstance | null {
  if (root.__rangeScaleInstance) return root.__rangeScaleInstance;

  const fields = [...root.querySelectorAll<HTMLInputElement>('input[type="range"]')];
  if (fields.length === 0) return null;
  const readout = root.querySelector<HTMLOutputElement>("output.value");
  const digits = readout?.querySelector(".digits") ?? null;

  /* Where the unit comes from, or `null` when nothing declares one — upstream
     `ae6086f`. `data-suffix` on the LANE is the general form and works with or
     without a visible readout; on the output it is the older, narrower spelling
     and stays supported, with the root winning when both are present. An output
     carrying no unit still means "we own the readout", so the announcement is
     the bare number, which is true. With neither source we leave
     `aria-valuetext` alone: a value we cannot format belongs to the host. */
  const suffixSource: string | null =
    root.dataset.suffix ?? readout?.dataset.suffix ?? (readout ? "" : null);

  const positionOf = (field: HTMLInputElement) =>
    normalise(field.valueAsNumber, Number(field.min || 0), Number(field.max || 100));

  const sync = () => {
    const positions = fields.map(positionOf);

    /* A lane with two controls publishes both ends, sorted by VALUE rather
     * than document order — an owner may have just clamped one of them. */
    if (positions.length > 1) {
      const [a, b] = [...positions].sort((x, y) => x - y);
      root.style.setProperty("--_rs-a", String(a));
      root.style.setProperty("--_rs-b", String(b));
    }

    root.style.setProperty("--_rs-p", String(positions[positions.length - 1]));

    /* Never for a pair: a span's spoken value is a statement about the pair,
     * which whatever owns the pair has to write.
     *
     * The readout and the announcement are now separate conditions. The digits
     * are written when there IS a readout; `aria-valuetext` is written whenever
     * the unit is KNOWABLE. A lane with no readout but `data-suffix` on the root
     * is exactly the case that used to need a static authored `aria-valuetext`,
     * which then drifted: the reference demo shipped "50 %" and seven arrow
     * presses later announced 50 for a value of 57. */
    if (fields.length === 1) {
      const raw = fields[0].value;
      digits?.replaceChildren(raw);
      if (suffixSource !== null) {
        fields[0].setAttribute(
          "aria-valuetext",
          suffixSource ? `${raw} ${suffixSource}` : raw,
        );
      }
    }
  };

  const instance: RangeScaleInstance = {
    sync,
    get value() {
      return fields[0].valueAsNumber;
    },
    get position() {
      return Number(root.style.getPropertyValue("--_rs-p") || 0);
    },
    destroy() {
      for (const field of fields) field.removeEventListener("input", sync);
      delete root.__rangeScaleInstance;
    },
  };

  for (const field of fields) field.addEventListener("input", sync);
  root.__rangeScaleInstance = instance;
  /* Not a gap-fill: the server already rendered the correct position. This only
   * covers a browser that restored a different value on reload. */
  sync();
  return instance;
}

/** `RangeScale.attach(parent?)`, ported verbatim in intent: mount every
 *  server-rendered lane in `parent`. Exported because the contract exports it. */
export function attach(parent: Document | HTMLElement = document): void {
  for (const el of parent.querySelectorAll<HTMLElement>('[data-component="RangeScale"]'))
    mount(el as LaneElement);
}

/* Called at CLIENT MODULE EVALUATION, which precedes hydration — this is what
 * closes the load-event race described in the header. Guarded for the server
 * render, and again for the case where the chunk evaluates before the markup it
 * belongs to has been parsed. */
if (typeof document !== "undefined") {
  attach();
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => attach(), { once: true });
}

export function RangeScale({
  id,
  label,
  name = id,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 0,
  disabled,
  invalid,
  output = true,
  suffix,
  valueText,
  lane,
  ticks,
  stops,
  fill,
  orientation,
  minPosition,
  reference,
  referenceVariant,
  referenceLayer,
  referenceFrom,
  referenceTo,
  hint,
  testState,
  dataId,
  styleOverrides,
}: RangeScaleProps) {
  const rootRef = useRef<LaneElement>(null);

  /* Idempotent, so it cannot fight the module-level attach. No `useCallback`:
   * anything derived from a render value here is a build error under the React
   * compiler ("Existing memoization could not be preserved"). */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    mount(root);
    return () => root.__rangeScaleInstance?.destroy();
  }, []);

  const hasOutput = output;
  const hintId = hint ? `${id}-hint` : undefined;

  /* `--_rs-p` is authored in the style attribute so the FIRST PAINT is correct
   * without JavaScript, and it must MERGE into any other authored style rather
   * than replace it — hence `styleOverrides` spread last. */
  const style: StyleVars = {
    "--_rs-p": normalise(defaultValue, min, max),
    /* Room for the widest NUMBER the readout can show, from the attribute
     * strings exactly as the reference reserves it. Digits only: reserving the
     * whole string over-reserves by roughly a quarter. */
    ...(hasOutput
      ? { "--_rs-value-digits": Math.max(String(min).length, String(max).length) }
      : {}),
    ...(reference
      ? {
          "--_rs-ref-from": referenceFrom ?? 0,
          "--_rs-ref-to": referenceTo ?? 0,
        }
      : {}),
    ...styleOverrides,
  };

  return (
    <>
      {/* The accessible name comes from the label, and the label sits OUTSIDE
          the lane: the lane is a grid of stacked layers and a label is not one
          of them. */}
      <label htmlFor={id}>{label}</label>
      <div
        ref={rootRef}
        className="RangeScale"
        data-component="RangeScale"
        data-id={dataId}
        /* The unit belongs to the LANE, not to the readout — upstream `ae6086f`.
           A lane with no visible readout still has a unit, and this is what lets
           it announce one without an authored `aria-valuetext` going stale. Still
           emitted on the output too, which is the older spelling upstream keeps
           supporting; `mount()` gives the root precedence when both are set. */
        data-suffix={suffix}
        data-lane={lane}
        data-ticks={ticks}
        data-fill={fill}
        data-orientation={orientation}
        data-min={minPosition}
        data-invalid={invalid ? "true" : undefined}
        data-reference={reference}
        data-reference-variant={referenceVariant}
        data-reference-layer={referenceLayer}
        style={style}
      >
        {/* `.track`, `.fill`, `.reference` and the field share one grid area, so
            the whole lane surface stays the input's hit target. The layers carry
            `pointer-events: none`. */}
        <span className="track" />
        <span className="fill" />
        {reference ? <span className="reference" /> : null}

        <input
          className="RangeField"
          type="range"
          id={id}
          name={name}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          disabled={disabled}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={hintId}
          /* Server-rendered so the announced value is right before hydration,
             and gated on the same "is the unit knowable" test `sync()` uses: a
             readout, or a `suffix`. With neither, an authored `valueText` is the
             host's and the lane must not overwrite it. */
          aria-valuetext={
            suffix
              ? `${defaultValue} ${suffix}`
              : hasOutput
                ? String(defaultValue)
                : valueText
          }
          data-invalid={invalid ? "true" : undefined}
          data-orientation={orientation}
          data-min={minPosition}
          data-test-state={testState}
        />

        {/* aria-hidden is not a compromise: nothing in ARIA models tick marks,
            and `step` already makes the keyboard land on exactly these stops, so
            both channels agree without any ARIA. The label text stays in the
            markup for `marks` too — switching axis is one attribute, never a
            markup change. */}
        {stops ? (
          <span className="ticks" aria-hidden="true">
            {stops.map((stop) => (
              <i key={stop.p} style={{ "--p": stop.p } as StyleVars}>
                {/* The typography lives on the CHILD: the stop element carries
                    geometry and must keep the lane's font-size, or the em
                    lengths shrink with the label. */}
                <span>{stop.label}</span>
              </i>
            ))}
          </span>
        ) : null}

        {hasOutput ? (
          /* `aria-live="off"` is AUTHORED MARKUP, not something the component
             adds at runtime — a bare <output> computes to role=status with
             live=polite and atomic=true, so the focused slider's own
             announcement would be duplicated, and repeated at every step of a
             drag. The suite asserts the computed `live` property through CDP,
             not the attribute, so this cannot be satisfied by writing it later. */
          <output className="value" aria-live="off" htmlFor={id} data-suffix={suffix}>
            <span className="digits">{defaultValue}</span>
            {suffix ? ` ${suffix}` : ""}
          </output>
        ) : null}

        {hint ? (
          <p className="hint" id={hintId}>
            {/* The swatch inherits `--_rs-ref-ink`, which is the only way to
                guarantee it matches the layer without the author restating the
                variant. */}
            <span className="swatch" aria-hidden="true" />
            {hint}
          </p>
        ) : null}
      </div>
    </>
  );
}

export default RangeScale;
