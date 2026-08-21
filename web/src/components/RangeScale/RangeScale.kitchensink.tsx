/* RangeScale kitchensink — every state the conformance suite anchors on, plus
 * the ones the reference demo page shows for eyeballing.
 *
 * `anchorId="RangeScale"` is load-bearing: the spec runs
 * `checkA11y(page, '#RangeScale')`, an id that belongs to the reference's own
 * demo *section* and is documented nowhere. See Findings.md F-014 / F-018.
 *
 * Every lane gets an explicit inline-size. That is not decoration: the suite's
 * last test asserts the lane's width does not change when the value crosses a
 * digit boundary, and in a shrink-to-fit flex cell the lane would size to its
 * readout. The reference demo gets the same effect for free from a table cell.
 */

import type { ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { RangeScale, type RangeScaleStop } from "./RangeScale";

/** A width-bounded slot for one lane. The label-styling utilities are repeated
 *  here because `Cell` only reaches its own direct-child labels.
 *
 *  `max-w-full min-w-0` is WCAG 1.4.10 Reflow, not styling. The lane needs a
 *  DEFINITE width — the suite's last test asserts the lane does not resize when
 *  the value crosses a digit boundary, which a shrink-to-fit lane would fail —
 *  but a plain `w-[18rem]` overflows a 320 px viewport by 71 px. `Cell` already
 *  carries `min-w-0` so the auto track can shrink; `max-w-full` is what makes
 *  the lane follow it down, and `min-w-0` here stops the native range's own
 *  intrinsic width becoming a floor. Verified 0 px document overflow at 320 px. */
function Slot({
  width = "w-full max-w-[18rem]",
  dir,
  children,
}: {
  width?: string;
  dir?: "rtl";
  children: ReactNode;
}) {
  return (
    <div
      dir={dir}
      className={`grid min-w-0 gap-xxs [&>label]:text-body-sm [&>label]:text-body ${width}`}
    >
      {children}
    </div>
  );
}

const EVEN: RangeScaleStop[] = [
  { p: 0, label: "0" },
  { p: 0.25, label: "25" },
  { p: 0.5, label: "50" },
  { p: 0.75, label: "75" },
  { p: 1, label: "100" },
];

/* Genuinely uneven — one expression, no gradient period arithmetic. */
const UNEVEN: RangeScaleStop[] = [
  { p: 0, label: "0" },
  { p: 0.1, label: "10" },
  { p: 0.3, label: "30" },
  { p: 0.7, label: "70" },
  { p: 1, label: "100" },
];

export function RangeScaleKitchensink() {
  return (
    <Section id="rangescale" title="RangeScale" anchorId="RangeScale">
      <p className="mb-lg max-w-[70ch] text-body-md">
        The lane a RangeField is measured against. It has no interaction states of
        its own; these rows verify it does not swallow the field&rsquo;s, and that
        the whole lane surface stays the input&rsquo;s hit target.
      </p>

      <Block title="Interaction states — at minimum">
        <Cell caption="default">
          <Slot>
            <RangeScale id="rs-min-default" label="Volume" defaultValue={0} suffix="%" />
          </Slot>
        </Cell>
        <Cell caption="hover">
          <Slot>
            <RangeScale
              id="rs-min-hover"
              label="Volume"
              defaultValue={0}
              suffix="%"
              testState="hover"
            />
          </Slot>
        </Cell>
        <Cell caption="focus">
          <Slot>
            <RangeScale
              id="rs-min-focus"
              label="Volume"
              defaultValue={0}
              suffix="%"
              testState="focus"
            />
          </Slot>
        </Cell>
        <Cell caption="active">
          <Slot>
            <RangeScale
              id="rs-min-active"
              label="Volume"
              defaultValue={0}
              suffix="%"
              testState="active"
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Interaction states — partially filled">
        <Cell caption="default">
          <Slot>
            <RangeScale id="rs-mid-default" label="Volume" defaultValue={50} suffix="%" />
          </Slot>
        </Cell>
        <Cell caption="hover">
          <Slot>
            <RangeScale
              id="rs-mid-hover"
              label="Volume"
              defaultValue={50}
              suffix="%"
              testState="hover"
            />
          </Slot>
        </Cell>
        <Cell caption="focus">
          <Slot>
            <RangeScale
              id="rs-mid-focus"
              label="Volume"
              defaultValue={50}
              suffix="%"
              testState="focus"
            />
          </Slot>
        </Cell>
        <Cell caption="active">
          <Slot>
            <RangeScale
              id="rs-mid-active"
              label="Volume"
              defaultValue={50}
              suffix="%"
              testState="active"
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Disabled">
        <Cell caption="native disabled on the field">
          <Slot>
            <RangeScale id="rs-disabled" label="Volume" defaultValue={50} suffix="%" disabled />
          </Slot>
        </Cell>
      </Block>

      <Block title="Invalid">
        <Cell caption="out of policy — data-invalid on both tiers">
          <Slot>
            <RangeScale id="rs-invalid" label="Volume" defaultValue={50} suffix="%" invalid />
          </Slot>
        </Cell>
      </Block>

      <Block title="Lane model — a documented choice">
        <Cell caption="inset (default) — box contains its own ink">
          <Slot>
            <RangeScale
              id="rs-lane-inset"
              dataId="rangescale-inset"
              label="Volume (lane: inset)"
              defaultValue={50}
              suffix="%"
              lane="inset"
            />
          </Slot>
        </Cell>
        <Cell caption="flush — scale reaches the visible ends">
          <Slot>
            <RangeScale
              id="rs-lane-flush"
              dataId="rangescale-flush"
              label="Volume (lane: flush)"
              defaultValue={50}
              suffix="%"
              lane="flush"
            />
          </Slot>
        </Cell>
        <Cell caption="flush at min — the thumb overhangs">
          <Slot>
            <RangeScale
              id="rs-lane-flush-min"
              label="At minimum"
              defaultValue={0}
              suffix="%"
              lane="flush"
            />
          </Slot>
        </Cell>
        <Cell caption="flush at max — the thumb overhangs">
          <Slot>
            <RangeScale
              id="rs-lane-flush-max"
              label="At maximum"
              defaultValue={100}
              suffix="%"
              lane="flush"
            />
          </Slot>
        </Cell>
        <Cell caption="partial (--_rs-inset: 0.25em)">
          <Slot>
            <RangeScale
              id="rs-lane-partial"
              dataId="rangescale-partial"
              label="Volume (partial overhang)"
              defaultValue={50}
              suffix="%"
              styleOverrides={{ "--_rs-inset": "0.25em" } as React.CSSProperties}
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Ticks">
        <Cell caption="marks — stops drawn, labels not rendered">
          <Slot>
            <RangeScale
              id="rs-ticks-marks"
              dataId="rangescale-ticks-marks"
              label="Volume (ticks: marks)"
              defaultValue={50}
              step={25}
              suffix="%"
              ticks="marks"
              stops={EVEN}
            />
          </Slot>
        </Cell>
        <Cell caption="labels — same markup, one attribute changed">
          <Slot>
            <RangeScale
              id="rs-ticks-labels"
              dataId="rangescale-ticks-labels"
              label="Volume (ticks: labels)"
              defaultValue={50}
              step={25}
              suffix="%"
              ticks="labels"
              stops={EVEN}
            />
          </Slot>
        </Cell>
        <Cell caption="labels on a flush lane — first and last stop land on the ends">
          <Slot>
            <RangeScale
              id="rs-ticks-flush"
              dataId="rangescale-ticks-flush"
              label="Volume (labels, flush lane)"
              defaultValue={50}
              step={25}
              suffix="%"
              ticks="labels"
              lane="flush"
              stops={EVEN}
            />
          </Slot>
        </Cell>
        <Cell caption="uneven stops — one expression, no gradient period">
          <Slot>
            <RangeScale
              id="rs-ticks-uneven"
              dataId="rangescale-ticks-uneven"
              label="Pressure (uneven stops)"
              defaultValue={40}
              step={10}
              suffix="bar"
              ticks="labels"
              stops={UNEVEN}
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Variants">
        <Cell caption="no readout (the <output>'s presence is the switch)">
          <Slot>
            <RangeScale
              id="rs-no-output"
              dataId="rangescale-no-output"
              label="Volume (no readout)"
              defaultValue={50}
              output={false}
              valueText="50 %"
            />
          </Slot>
        </Cell>
        <Cell caption="scales with text (font-size only)">
          <Slot width="w-full max-w-[22rem]">
            <RangeScale
              id="rs-text-scaled"
              dataId="rangescale-text-scaled"
              label="Volume (font-size: 1.5rem)"
              defaultValue={50}
              suffix="%"
              styleOverrides={{ fontSize: "1.5rem" }}
            />
          </Slot>
        </Cell>
        <Cell caption="RTL — the fill anchors right, with no extra rule">
          <Slot dir="rtl">
            <RangeScale
              id="rs-rtl"
              dataId="rangescale-rtl"
              label="الحجم"
              defaultValue={50}
              suffix="%"
            />
          </Slot>
        </Cell>
        <Cell caption="vertical, min at the bottom (default)">
          <Slot width="w-full max-w-[6rem]">
            <RangeScale
              id="rs-vertical"
              dataId="rangescale-vertical"
              label="Volume (vertical)"
              defaultValue={50}
              output={false}
              orientation="vertical"
            />
          </Slot>
        </Cell>
        <Cell caption="vertical, min at the top">
          <Slot width="w-full max-w-[6rem]">
            <RangeScale
              id="rs-vertical-top"
              dataId="rangescale-vertical-top"
              label="Depth (min at top)"
              defaultValue={50}
              output={false}
              orientation="vertical"
              minPosition="top"
            />
          </Slot>
        </Cell>
        <Cell caption="vertical, flush">
          <Slot width="w-full max-w-[6rem]">
            <RangeScale
              id="rs-vertical-flush"
              dataId="rangescale-vertical-flush"
              label="Volume (vertical, flush)"
              defaultValue={50}
              output={false}
              orientation="vertical"
              lane="flush"
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Reference layer">
        <Cell caption="region — drag below 20 and it stops following">
          <Slot>
            <RangeScale
              id="rs-ref-region"
              dataId="rangescale-ref-region"
              label="Data allowance"
              defaultValue={50}
              suffix="GB"
              reference="region"
              referenceFrom={0}
              referenceTo={0.2}
              hint="Already used: 20 GB. Setting the limit below that stops all traffic."
            />
          </Slot>
        </Cell>
        <Cell caption="region, no fill — nothing to clamp against">
          <Slot>
            <RangeScale
              id="rs-ref-region-nofill"
              dataId="rangescale-ref-region-nofill"
              label="Data allowance (no fill)"
              defaultValue={50}
              output={false}
              reference="region"
              fill="none"
              referenceFrom={0}
              referenceTo={0.2}
              hint="Already used: 20 GB."
            />
          </Slot>
        </Cell>
        <Cell caption="band — a bracket above the lane by default">
          <Slot>
            <RangeScale
              id="rs-ref-band"
              dataId="rangescale-ref-band"
              label="Loan amount"
              min={0}
              max={1000}
              step={10}
              defaultValue={400}
              suffix="tkr"
              reference="band"
              referenceFrom={0.3}
              referenceTo={0.5}
              hint="Recommended level: 300–500 tkr."
            />
          </Slot>
        </Cell>
        <Cell caption="band + variant — colour-coded, drawn on the fill">
          <Slot>
            <RangeScale
              id="rs-ref-band-variant"
              dataId="rangescale-ref-band-variant"
              label="Loan amount (colour-coded)"
              min={0}
              max={1000}
              step={10}
              defaultValue={400}
              suffix="tkr"
              reference="band"
              referenceVariant="warning"
              referenceFrom={0.3}
              referenceTo={0.5}
              hint="Above 500 tkr the interest rate increases."
            />
          </Slot>
        </Cell>
        <Cell caption="band forced under — why it is not the default">
          <Slot>
            <RangeScale
              id="rs-ref-band-under"
              dataId="rangescale-ref-band-under"
              label="Band, forced under the fill"
              step={5}
              defaultValue={60}
              output={false}
              reference="band"
              referenceLayer="under"
              referenceVariant="info"
              referenceFrom={0.3}
              referenceTo={0.5}
              hint="Least legible exactly when the value covers it — which is why it is not the default."
            />
          </Slot>
        </Cell>
        <Cell caption="marker — a band of no width">
          <Slot>
            <RangeScale
              id="rs-ref-marker"
              dataId="rangescale-ref-marker"
              label="Your bid"
              defaultValue={35}
              suffix="%"
              reference="marker"
              referenceVariant="success"
              referenceFrom={0.62}
              referenceTo={0.62}
              hint="Median bid in this area: 62 %."
            />
          </Slot>
        </Cell>
        <Cell caption="band + ticks — same expression, neither knows the other">
          <Slot>
            <RangeScale
              id="rs-ref-with-ticks"
              dataId="rangescale-ref-with-ticks"
              label="Pressure (band + ticks)"
              step={25}
              defaultValue={50}
              suffix="bar"
              lane="flush"
              ticks="labels"
              stops={EVEN}
              reference="band"
              referenceVariant="success"
              referenceFrom={0.25}
              referenceTo={0.75}
              hint="Safe operating band: 25–75 bar."
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Live demo">
        <Cell caption="drag it — fill, readout and announced value move together">
          <Slot>
            <RangeScale
              id="rs-live"
              dataId="rangescale-live"
              label="Volume"
              defaultValue={50}
              suffix="%"
            />
          </Slot>
        </Cell>
      </Block>

      <Block title="Native reference">
        <Cell caption="unstyled range — no fill in Chromium or WebKit, no readout">
          <Slot>
            <label htmlFor="rs-native" className="text-body-sm text-body">
              Volume
            </label>
            <input
              type="range"
              id="rs-native"
              name="rs-native"
              min={0}
              max={100}
              step={25}
              defaultValue={50}
              list="rs-native-ticks"
            />
            <datalist id="rs-native-ticks">
              <option value="0" />
              <option value="25" />
              <option value="50" />
              <option value="75" />
              <option value="100" />
            </datalist>
          </Slot>
        </Cell>
      </Block>
    </Section>
  );
}

export default RangeScaleKitchensink;
