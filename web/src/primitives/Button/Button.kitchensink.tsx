/* Button.kitchensink.tsx — every axis the Razor source exposes.
 *
 * There is no conformance suite for this primitive set, so this page is the
 * whole inspection surface: what is not demonstrated here is not checked by
 * anything. The axes are therefore enumerated exhaustively rather than
 * representatively — emphasis × intent × size × pill × icon × icon-position ×
 * icon-only × disabled, plus the four `data-test-state` pseudo-state pins.
 *
 * The state columns use `Button.css`'s own `[data-test-state]` hook rather than
 * real `:hover` / `:focus-visible`, which is what makes hover and focus
 * inspectable in a static screenshot AND measurable by a `getComputedStyle`
 * probe. That hook is the source stylesheet's, not ours.
 *
 * Icons come from an inline sprite defined at the bottom of this file, because
 * `<use href="#id">` needs same-document fragments and the source app supplies
 * them from a Razor layout partial we are not porting.
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { ActionButton } from "./ActionButton";
import { CtaLinkButton } from "./CtaLinkButton";
import { LinkButton } from "./LinkButton";
import type { Emphasis, Intent, Size } from "./buttonAttributes";

const EMPHASES: Emphasis[] = ["primary", "secondary", "tertiary"];
const INTENTS: Intent[] = ["neutral", "destructive", "success"];
const SIZES: Size[] = ["sm", "md", "lg"];
const STATES = ["hover", "focus", "active"] as const;

export function ButtonKitchensink() {
  return (
    <>
      <IconSprite />

      <Section id="action-button" title="ActionButton — app-action-button">
        <Block title="Emphasis × interaction state (intent neutral, size md)">
          {EMPHASES.map((emphasis) => (
            <Cell key={emphasis} caption={emphasis}>
              <ActionButton emphasis={emphasis}>Default</ActionButton>
              {STATES.map((s) => (
                <ActionButton key={s} emphasis={emphasis} testState={s}>
                  {s}
                </ActionButton>
              ))}
            </Cell>
          ))}
        </Block>

        <Block title="Emphasis × intent">
          {EMPHASES.map((emphasis) => (
            <Cell key={emphasis} caption={emphasis}>
              {INTENTS.map((intent) => (
                <ActionButton key={intent} emphasis={emphasis} intent={intent}>
                  {intent}
                </ActionButton>
              ))}
            </Cell>
          ))}
        </Block>

        <Block title="Size × pill">
          {SIZES.map((size) => (
            <Cell key={size} caption={size}>
              <ActionButton size={size}>pill false</ActionButton>
              <ActionButton size={size} pill>
                pill true
              </ActionButton>
              <ActionButton size={size} emphasis="secondary">
                secondary
              </ActionButton>
              <ActionButton size={size} emphasis="secondary" pill>
                secondary pill
              </ActionButton>
            </Cell>
          ))}
        </Block>

        <Block title="Icon × icon-position × size">
          {SIZES.map((size) => (
            <Cell key={size} caption={size}>
              <ActionButton size={size} icon="icon-arrow-right" iconPosition="right">
                right
              </ActionButton>
              <ActionButton size={size} icon="icon-arrow-left" iconPosition="left">
                left
              </ActionButton>
              <ActionButton size={size}>no icon</ActionButton>
            </Cell>
          ))}
        </Block>

        <Block title="Icon-only (icon + no children → data-icon-only)">
          {SIZES.map((size) => (
            <Cell key={size} caption={size}>
              <ActionButton size={size} icon="icon-plus" ariaLabel={`Add (${size})`} />
              <ActionButton
                size={size}
                emphasis="secondary"
                icon="icon-plus"
                ariaLabel={`Add secondary (${size})`}
              />
              <ActionButton
                size={size}
                emphasis="secondary"
                pill
                icon="icon-plus"
                ariaLabel={`Add pill (${size})`}
              />
            </Cell>
          ))}
        </Block>

        <Block title="Disabled — a functional state, so it gets no interaction columns">
          {EMPHASES.map((emphasis) => (
            <Cell key={emphasis} caption={emphasis}>
              <ActionButton emphasis={emphasis} disabled>
                disabled
              </ActionButton>
              <ActionButton emphasis={emphasis} disabled icon="icon-arrow-right">
                disabled + icon
              </ActionButton>
              <ActionButton emphasis={emphasis} testState="disabled">
                pinned
              </ActionButton>
            </Cell>
          ))}
        </Block>

        <Block title="button-type">
          <Cell caption="button (default)">
            <ActionButton>button</ActionButton>
          </Cell>
          <Cell caption="submit">
            <ActionButton buttonType="submit">submit</ActionButton>
          </Cell>
          <Cell caption="reset">
            <ActionButton buttonType="reset">reset</ActionButton>
          </Cell>
        </Block>

        <Block title="Suppression rule — no children, no icon, no aria-label renders nothing">
          <Cell caption="empty (renders null)">
            <ActionButton />
          </Cell>
          <Cell caption="aria-label only">
            <ActionButton ariaLabel="Labelled but empty" />
          </Cell>
        </Block>
      </Section>

      <Section id="link-button" title="LinkButton — app-link-button">
        <Block title="Emphasis × interaction state (no intent axis on this component)">
          {EMPHASES.map((emphasis) => (
            <Cell key={emphasis} caption={emphasis}>
              <LinkButton href="#link-button" emphasis={emphasis}>
                Default
              </LinkButton>
              {STATES.map((s) => (
                <LinkButton key={s} href="#link-button" emphasis={emphasis} testState={s}>
                  {s}
                </LinkButton>
              ))}
            </Cell>
          ))}
        </Block>

        <Block title="Size × pill × icon">
          {SIZES.map((size) => (
            <Cell key={size} caption={size}>
              <LinkButton href="#link-button" size={size}>
                plain
              </LinkButton>
              <LinkButton href="#link-button" size={size} pill icon="icon-arrow-right">
                pill + icon
              </LinkButton>
              <LinkButton
                href="#link-button"
                size={size}
                icon="icon-arrow-left"
                iconPosition="left"
              >
                icon left
              </LinkButton>
              <LinkButton
                href="#link-button"
                size={size}
                icon="icon-plus"
                ariaLabel={`Add link (${size})`}
              />
            </Cell>
          ))}
        </Block>

        <Block title="target — _blank gains rel=noopener noreferrer">
          <Cell caption="no target">
            <LinkButton href="https://example.com">same tab</LinkButton>
          </Cell>
          <Cell caption='target="_blank"'>
            <LinkButton href="https://example.com" target="_blank">
              new tab
            </LinkButton>
          </Cell>
          <Cell caption='target="_self"'>
            <LinkButton href="https://example.com" target="_self">
              self
            </LinkButton>
          </Cell>
        </Block>

        <Block title="No href — the source still emits an <a>, which has no link role">
          <Cell caption="href omitted">
            <LinkButton emphasis="secondary">not a link</LinkButton>
          </Cell>
        </Block>
      </Section>

      <Section id="cta-link-button" title="CtaLinkButton — app-cta-link-button">
        <Block title="Variant glow × interaction state">
          <Cell caption="default">
            <CtaLinkButton href="#cta-link-button">Get started</CtaLinkButton>
          </Cell>
          {STATES.map((s) => (
            <Cell key={s} caption={s}>
              <CtaLinkButton href="#cta-link-button" testState={s}>
                Get started
              </CtaLinkButton>
            </Cell>
          ))}
          <Cell caption="disabled (pinned)">
            <CtaLinkButton href="#cta-link-button" testState="disabled">
              Get started
            </CtaLinkButton>
          </Cell>
        </Block>

        <Block title="Icon — always right, no position axis">
          <Cell caption="no icon">
            <CtaLinkButton href="#cta-link-button">Download</CtaLinkButton>
          </Cell>
          <Cell caption="with icon">
            <CtaLinkButton href="#cta-link-button" icon="icon-arrow-right">
              Download
            </CtaLinkButton>
          </Cell>
          <Cell caption='target="_blank"'>
            <CtaLinkButton href="https://example.com" target="_blank" icon="icon-arrow-right">
              External
            </CtaLinkButton>
          </Cell>
        </Block>
      </Section>
    </>
  );
}

/* The sprite the `<use href="#…">` references resolve against. Upstream this
 * comes from a Razor layout partial; the icon set is not part of this port, so
 * these are minimal stand-ins with the same 24-unit viewBox the source assumes.
 * `aria-hidden` + `display:none` keeps the sprite itself out of the a11y tree
 * and out of layout. */
function IconSprite() {
  return (
    <svg aria-hidden="true" focusable="false" style={{ display: "none" }}>
      <symbol id="icon-arrow-right" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12h14m-6-6 6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-arrow-left" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 12H5m6-6-6 6 6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-plus" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </symbol>
    </svg>
  );
}
