/* ToggleTip kitchensink — every state, plus every anchor the suite needs.
 *
 * The `data-id` values are TEST CONTRACT, taken from
 * reference-components/src/partials/components/ToggleTip/tests/ToggleTip.e2e.test.js.
 * All five are hard-coded there; ToggleTip has NO entry in e2e-helpers/target.js,
 * so `TARGET_ID` cannot redirect them:
 *
 *   near-top     → flip-below test (scrolled to 4px from the top of a 100px viewport)
 *   inline       → open / close / outside-click / Enter / focusout (5 tests)
 *   left-edge    → must clamp so bubble.x >= 0 at 800px wide
 *   right-edge   → must clamp so bubble.x + width <= 800
 *   center       → default-above test AND both axe runs (closed + open)
 *
 * The layout of the four positioning anchors is contract too, not decoration:
 * `left-edge` must sit at the left extreme of a full-width row and `right-edge`
 * at the right, or the clamp being asserted is never exercised. The reference
 * uses inline `display:flex` styles for exactly this; Tailwind utilities express
 * the same thing.
 *
 * `center` is deliberately the LAST block. The default-above test scrolls the
 * page to `absoluteTop - 600` in a 720px viewport so that space above the
 * trigger clearly exceeds space below — detectDirection treats a vertically
 * centred trigger as a tie. Putting `center` low on a tall page makes that
 * scroll possible.
 */

import { Block, Cell, Section } from "../kitchensink-ui";
import { ToggleTip } from "./ToggleTip";

export function ToggleTipKitchensink() {
  return (
    <Section id="toggletip" title="ToggleTip">
      {/* 1 — Interaction states.
             The trigger is a plain <button> whose styling is `all: unset` plus a
             2rem invisible hit area; there is no hover/focus/active skin in the
             reference stylesheet at all, so the interaction row shows the two
             icon variants rather than inventing states the contract does not
             define. */}
      <Block title="Icon variants">
        <Cell caption="info (default)">
          <ToggleTip dataId="icon-info">
            The info icon. Default <code>aria-label</code>: “More information”.
          </ToggleTip>
        </Cell>
        <Cell caption="question">
          <ToggleTip dataId="icon-question" icon="question">
            The question icon. Default <code>aria-label</code>: “Learn more”.
          </ToggleTip>
        </Cell>
        <Cell caption="custom aria-label">
          <ToggleTip dataId="custom-label" label="About VAT">
            The contract asks implementers to match the surrounding context
            rather than ship the generic label.
          </ToggleTip>
        </Cell>
      </Block>

      {/* 2 — Variants: with and without the bubble heading. */}
      <Block title="Variants">
        <Cell caption="no heading">
          <ToggleTip dataId="variant-plain">Content only, no heading row.</ToggleTip>
        </Cell>
        <Cell caption="heading (aria-level 3)">
          <ToggleTip dataId="variant-heading" heading="A title">
            A heading renders as <code>span.title</code> with{" "}
            <code>role=&quot;heading&quot;</code>.
          </ToggleTip>
        </Cell>
        <Cell caption="heading (aria-level 4)">
          <ToggleTip dataId="variant-heading-level" heading="Deeper heading" headingLevel={4}>
            <code>headingLevel</code> maps to <code>aria-level</code>.
          </ToggleTip>
        </Cell>
        <Cell caption="long content (wraps)">
          <ToggleTip dataId="variant-long" heading="Bubble sizing">
            The bubble is <code>20rem</code> wide, capped at{" "}
            <code>100vw - 2 × --SITE--PADDING</code>, with a{" "}
            <code>20ch</code> floor — so long content wraps rather than pushing
            past the viewport edge.
          </ToggleTip>
        </Cell>
      </Block>

      {/* 3 — Direction: the flip anchor. Placed high in the page so the flip
             test can scroll it to 4px from the viewport top. */}
      <Block title="Direction — flips below when there is no room above">
        <Cell caption="near-top (e2e anchor)">
          <ToggleTip dataId="near-top">
            Near the top of the page — should flip to below.
          </ToggleTip>
        </Cell>
      </Block>

      {/* 4 — Inline: the open/close/keyboard/dismiss anchor. `<toggle-tip>` is
             `display: inline-block; vertical-align: middle`, so it is genuinely
             usable mid-sentence.
             The wrapper is a <div>, NOT a <p>, and that is load-bearing rather
             than cosmetic. `<toggle-tip>` renders `<div class="rail">` inside
             itself, and a `<div>` start tag implies the end tag of any open
             `<p>` — so the parser hoists `.rail`/`.popup` out of the component
             entirely and `toggle-tip .popup` stops existing. Measured: with a
             `<p>` wrapper, 9 of 11 conformance tests fail. The reference demo's
             own `ToggleTip.html` has this bug. See findings/ToggleTip.md. */}
      <Block title="Inline with text">
        <div className="text-body-md">
          Inline with text{" "}
          <ToggleTip dataId="inline">
            This is some content inside the toggle tip.
          </ToggleTip>{" "}
          more text after.
        </div>
      </Block>

      {/* 5 — Viewport clamping. Full-width rows so the anchors really do sit at
             each extreme of the page's content column. The clamp under test is
             VIEWPORT-relative (calculatePopupOffset takes viewportWidth and half
             of --SITE--PADDING as the inset), so the anchors do not need to touch
             the physical viewport edge for the assertion to bite — at the 800px
             viewport both tests use, a 320px bubble centred on either anchor
             would overflow without the clamp. */}
      <Block title="Viewport clamping">
        <div className="w-full">
          <div className="flex items-center justify-start gap-sm">
            <ToggleTip dataId="left-edge">
              Near the left edge — the bubble clamps right so it never crosses
              the viewport edge.
            </ToggleTip>
            <span className="text-body-sm">Near left edge — bubble should clamp right</span>
          </div>
          <div className="mt-base flex items-center justify-end gap-sm">
            <span className="text-body-sm">Near right edge — bubble should clamp left</span>
            <ToggleTip dataId="right-edge">
              Near the right edge — the bubble clamps left so it never crosses
              the viewport edge.
            </ToggleTip>
          </div>
        </div>
      </Block>

      {/* 6 — Live demo. `center` is the axe target for BOTH the closed and the
             open audit, and the default-above anchor. Last on the page by
             design (see the header note). */}
      <Block title="Live demo">
        <div className="flex w-full items-center justify-center gap-sm">
          <ToggleTip dataId="center" icon="question" heading="A title">
            Content with a title heading above it.
          </ToggleTip>
          <span className="text-body-sm">Centered, question icon, with title</span>
        </div>
      </Block>
    </Section>
  );
}
