/* Notice kitchensink — every state the conformance suite needs, plus the states
 * the reference's own Notice.html demonstrates.
 *
 * `anchorId="Notice"` IS TEST CONTRACT, not styling. Notice's e2e suite is an
 * older-generation spec: it does `page.goto('/')` and scopes every locator to
 * `#Notice` rather than going through `e2e-helpers/target.js`, so the section id
 * from the reference demo page — `<section class="kitchensink-section"
 * id="Notice">` — is load-bearing. `<Section>` spends its `id` prop on the
 * heading, so the element id comes from `anchorId`. See findings/Notice.md.
 *
 * Exactly ONE `data-icon="false"` Notice and ONE `[data-id="region"]` may exist
 * on the page: the suite calls `.evaluate()` on unfiltered locators for both, so
 * a second instance is a Playwright strict-mode failure, not a soft ambiguity.
 * The polite region is anchored `region-polite` for that reason.
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { Notice, NoticeRegion, type NoticeVariant } from "./Notice";

const VARIANTS: { variant: NoticeVariant; title: string; body: string }[] = [
  {
    variant: "error",
    title: "Validation error",
    body: "Please fill in all required fields before continuing.",
  },
  {
    variant: "warning",
    title: "Almost out of space",
    body: "You have used 90% of your storage quota.",
  },
  { variant: "success", title: "Saved", body: "Your changes have been saved." },
  {
    variant: "info",
    title: "Heads up",
    body: "Maintenance is scheduled for Sunday at 02:00 UTC.",
  },
  {
    variant: "neutral",
    title: "Reminder",
    body: "Your trial ends in three days.",
  },
];

export function NoticeKitchensink() {
  return (
    <Section id="notice" anchorId="Notice" title="Notice">
      {/* Variants — one accent token per severity. The icon carries the
          meaning alongside the colour, so no variant ships without one. */}
      <Block title="Variants">
        <div className="flex w-full flex-col gap-lg">
          {VARIANTS.map(({ variant, title, body }) => (
            <Cell key={variant} caption={`data-variant="${variant}"`}>
              <Notice
                variant={variant}
                title={title}
                dataId={`notice-${variant}`}
              >
                {body}
              </Notice>
            </Cell>
          ))}
        </div>
      </Block>

      {/* The three independent boolean toggles, basic → enriched. */}
      <Block title="Chrome toggles">
        <div className="flex w-full flex-col gap-lg">
          <Cell caption="base (no border, no emphasis)">
            <Notice variant="error" title="Validation error" dataId="notice-base">
              The calm coloured base — surface tint plus the accent icon.
            </Notice>
          </Cell>
          <Cell caption='data-border="true"'>
            <Notice
              variant="error"
              title="Validation error"
              border
              dataId="notice-border"
            >
              A full border in the accent colour.
            </Notice>
          </Cell>
          <Cell caption='data-emphasis="true"'>
            <Notice
              variant="info"
              title="Heads up"
              emphasis
              dataId="notice-emphasis"
            >
              A thick leading accent bar — the richest look.
            </Notice>
          </Cell>
          <Cell caption="enriched (border + emphasis)">
            <Notice
              variant="success"
              title="Saved"
              border
              emphasis
              dataId="notice-enriched"
            >
              Border and leading bar together — the most decorated Notice.
            </Notice>
          </Cell>
        </div>
      </Block>

      {/* Content shapes. `data-icon="false"` appears exactly once. */}
      <Block title="Content shapes">
        <div className="flex w-full flex-col gap-lg">
          <Cell caption='data-icon="false" — one column, no icon'>
            <Notice
              variant="info"
              title="Text only"
              icon={false}
              dataId="notice-no-icon"
            >
              <p>
                The icon column collapses when <code>data-icon=&quot;false&quot;</code>.
              </p>
            </Notice>
          </Cell>
          <Cell caption="no title — body only">
            <Notice variant="success" dataId="notice-no-title">
              A single-line confirmation with no heading.
            </Notice>
          </Cell>
          <Cell caption="single line">
            <Notice variant="error" dataId="notice-single-line">
              Please fill in all required fields before continuing.
            </Notice>
          </Cell>
          <Cell caption="long content — wraps inside the content column">
            <Notice
              variant="warning"
              title="Long message"
              dataId="notice-long"
            >
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco.
            </Notice>
          </Cell>
          <Cell caption="inline markup in the body">
            <Notice variant="info" title="With a link" dataId="notice-link">
              <p>
                The body may contain inline markup, including a{" "}
                <a href="#notice-link">link</a>.
              </p>
            </Notice>
          </Cell>
        </div>
      </Block>

      {/* The announcer. In real use the region is present and EMPTY at load
          and the host swaps a Notice into it; shown populated here to
          illustrate the structure, exactly as the reference demo does. */}
      <Block title="Live-region pattern (announcer)">
        <div className="flex w-full flex-col gap-lg">
          <Cell caption='role="alert" aria-live="assertive" — error / warning'>
            <NoticeRegion politeness="assertive" dataId="region">
              <Notice
                variant="error"
                title="Validation error"
                dataId="notice-announced"
              >
                Please fill in all required fields.
              </Notice>
            </NoticeRegion>
          </Cell>
          <Cell caption='role="status" aria-live="polite" — success / info / neutral'>
            <NoticeRegion politeness="polite" dataId="region-polite">
              <Notice
                variant="success"
                title="Saved"
                dataId="notice-announced-polite"
              >
                Your changes have been saved.
              </Notice>
            </NoticeRegion>
          </Cell>
        </div>
      </Block>
    </Section>
  );
}

export default NoticeKitchensink;
