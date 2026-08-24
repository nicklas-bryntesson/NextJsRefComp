/* Prose.kitchensink.tsx — every variant × size, plus a realistic long-form
 * sample exercising every element `Prose.css` styles.
 *
 * The sample matters more here than in any other port. Prose styles DESCENDANT
 * elements it does not render, so "does the component work" is not a question
 * about the component at all — it is a question about whether an arbitrary tree
 * of `<h2>`, `<ul>`, `<blockquote>`, `<pre>`, `<table>`, `<figure>` and `<hr>`
 * comes out right. If an element is not in the sample, nothing checks it.
 *
 * Element coverage, against Prose.css:
 *   basic    → p
 *   default  → + h1–h6, ul/ol/li, em/i, strong/b, nested inline, a, code,
 *              blockquote
 *   rich     → + pre, pre code, table/th/td, figure, figcaption, hr
 *
 * The long-form sample is rendered at `variant="rich"` (a superset) and again at
 * `basic` and `default`, so the *absence* of styling in the narrower variants is
 * visible rather than inferred.
 */

import type { ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import { Prose } from "./Prose";
import type { ProseElement, ProseSize, ProseVariant } from "./proseAttributes";

const SIZES: ProseSize[] = ["sm", "md", "lg"];
/* `aside` is deliberately absent from the live demos — see the block below.
   All five values remain legal props; only the demo omits one. */
const ELEMENTS: ProseElement[] = ["div", "section", "article", "footer"];

/* A measuring column. Prose is a long-form container, so a 320 px viewport must
 * still reflow it — `max-w-full` plus `Cell`'s `min-w-0` is what makes that
 * work (F-024). */
function Column({ children }: { children: ReactNode }) {
  return <div className="w-[38rem] max-w-full">{children}</div>;
}

/** The realistic sample. Deliberately NOT wrapped in `Prose` — each demo wraps
 *  it at a different variant, which is the point. */
function LongForm() {
  return (
    <>
      <h2>What the port actually measures</h2>
      <p>
        A component library ports cleanly when its <em>mechanisms</em> survive, not
        when its pixels do. The Razor primitive set is built on two mechanisms: a{" "}
        <code>data-*</code> axis on the root element, and a blank custom property
        that a gate selector fills. The first survives a React port untouched. The
        second does not survive a Tailwind conversion at all.
      </p>
      <h3>Three ordered steps</h3>
      <p>
        The method is <strong>lift, restyle, convert</strong> — and the ordering is
        the whole method. Doing two at once leaves two variables and nothing to
        bisect. A <strong>bold claim with <em>emphasis inside it</em></strong> is
        included here because <code>Prose.css</code> has a rule for exactly that
        nesting.
      </p>
      <ul>
        <li>
          Lift the structure. The stylesheet is copied byte-identical and the props
          keep the source&rsquo;s names.
        </li>
        <li>
          Restyle to the design system. Where the source has a step the design does
          not, say so rather than inventing one.
        </li>
        <li>
          Convert to utilities on the same DOM, keeping every structural class
          name. Guard it with a computed-style snapshot.
        </li>
      </ul>
      <h4>Why the ordering is load-bearing</h4>
      <ol>
        <li>A verbatim baseline is the only thing a diff can be taken against.</li>
        <li>
          A restyle changes values; a conversion changes <em>where values live</em>.
          Conflating them makes every regression ambiguous.
        </li>
        <li>
          The snapshot is the safety net, and a net only helps if it was hung
          before the fall.
        </li>
      </ol>
      <blockquote>
        <p>
          The utility layer cannot hold a relationship at all, so converting a
          relationship-based stylesheet to utilities always costs the relationship
          — whether or not the current numbers stay identical.
        </p>
      </blockquote>
      <h5>A code surface</h5>
      <p>
        Inline code such as <code>--_fontSize</code> and a block are both mono, and
        the design system says every code surface is JetBrains Mono:
      </p>
      <pre>
        <code>{`.Heading[data-variant="display"] {
  --_lineHeight: var(--lineHeight-display);
  font-family:  var(--fontFamily-display);
  font-weight:  var(--fontWeight-display);
}`}</code>
      </pre>
      <h6>A table, because rich styles one</h6>
      <table>
        <caption>Nine source steps against six design stops</caption>
        <thead>
          <tr>
            <th scope="col">Source step</th>
            <th scope="col">Desktop size</th>
            <th scope="col">Bridge target</th>
            <th scope="col">Ours</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>display-1</td>
            <td>64 px</td>
            <td>display-mega</td>
            <td>72 px</td>
          </tr>
          <tr>
            <td>display-2</td>
            <td>56 px</td>
            <td>display-lg</td>
            <td>36 px</td>
          </tr>
          <tr>
            <td>display-3</td>
            <td>48 px</td>
            <td>display-md</td>
            <td>26 px</td>
          </tr>
          <tr>
            <td>h1</td>
            <td>56 px</td>
            <td>display-lg</td>
            <td>36 px</td>
          </tr>
          <tr>
            <td>h6</td>
            <td>18 px</td>
            <td>caption-uppercase</td>
            <td>11 px</td>
          </tr>
        </tbody>
      </table>
      <figure>
        <div className="rounded-lg border border-hairline bg-surface-strong p-lg text-center">
          A stand-in for a figure&rsquo;s content
        </div>
        <figcaption>
          A figcaption at 0.875em and opacity 0.7 — the one contrast risk in this
          stylesheet.
        </figcaption>
      </figure>
      <hr />
      <p>
        A closing paragraph, so that <code>p:last-child</code> and its zeroed
        bottom margin are both exercised. Links look like{" "}
        <a href="#prose-longform">this one</a>, which inherits its colour and
        underlines at a 0.2em offset.
      </p>
    </>
  );
}

export function ProseKitchensink() {
  return (
    <>
      <Section id="prose-longform" title="Long-form sample × variant">
        <Block title="variant=rich — the superset: pre, table, figure, hr on top of everything default styles">
          <Cell caption="rich / md">
            <Column>
              <Prose variant="rich" size="md">
                <LongForm />
              </Prose>
            </Column>
          </Cell>
        </Block>

        <Block title="variant=default — same markup. pre / table / figure / hr are UNSTYLED here, which is the contract, not a defect">
          <Cell caption="default / md">
            <Column>
              <Prose variant="default" size="md">
                <LongForm />
              </Prose>
            </Column>
          </Cell>
        </Block>

        <Block title="variant=basic — only <p> is styled. Every heading, list and quote falls back to the UA stylesheet">
          <Cell caption="basic / md">
            <Column>
              <Prose variant="basic" size="md">
                <LongForm />
              </Prose>
            </Column>
          </Cell>
        </Block>
      </Section>

      <Section id="prose-size" title="Size — the --_fontSize gate">
        <Block title="data-size sets --_fontSize, which p / ul / ol / table read. Headings do NOT read it — they have their own scale, so size does not move them.">
          {SIZES.map((size) => (
            <Cell key={size} caption={size}>
              <Column>
                <Prose variant="rich" size={size}>
                  <h3>A heading, unaffected by size</h3>
                  <p>
                    Body text at size <code>{size}</code>. The gate only reaches
                    paragraphs, lists and tables.
                  </p>
                  <ul>
                    <li>A list item, which does read the gate.</li>
                  </ul>
                </Prose>
              </Column>
            </Cell>
          ))}
        </Block>
      </Section>

      <Section id="prose-element" title="Element — the wrapper tag">
        <Block title="Four of the five legal elements. An unknown value silently becomes div — unlike variant and size, which error.">
          {ELEMENTS.map((element) => (
            <Cell key={element} caption={`<${element}>`}>
              <Column>
                <Prose element={element} variant="basic" size="sm">
                  <p>Rendered inside a &lt;{element}&gt;.</p>
                </Prose>
              </Column>
            </Cell>
          ))}
        </Block>

        <Block title='element="aside" is a legal prop and is NOT demonstrated, on purpose'>
          <Cell caption="why it is absent">
            <Column>
              <p className="text-body-sm text-body">
                <code>&lt;aside&gt;</code> carries the <code>complementary</code>{" "}
                landmark role, and axe&rsquo;s{" "}
                <code>landmark-complementary-is-top-level</code> rule fails any
                complementary landmark nested inside another landmark. Every
                kitchensink page is inside <code>&lt;main&gt;</code>, so rendering
                the cell produced a real, moderate WCAG violation on this route in
                both appearances — measured, not predicted. The prop is kept
                because the source has it; the demo is dropped because a demo must
                not manufacture a violation. See findings/primitives-Prose.md.
              </p>
            </Column>
          </Cell>
        </Block>
      </Section>

      <Section id="prose-raw" title="rawHtml — the IHtmlContent branch">
        <Block title="The React analogue of the source's Content property: a pre-rendered CMS string. Wins over children, exactly as upstream.">
          <Cell caption="rawHtml">
            <Column>
              <Prose
                variant="rich"
                size="md"
                rawHtml={
                  "<h3>From a CMS field</h3>" +
                  "<p>This subtree came in as a <strong>string</strong>, not as React " +
                  "children — the case <code>Prose</code> exists for.</p>" +
                  "<ul><li>Still styled, because the selectors are descendant selectors.</li></ul>"
                }
              />
            </Column>
          </Cell>
        </Block>
      </Section>

      <Section id="prose-guards" title="Guards">
        <Block title="No content → nothing at all. Both cells are empty by design.">
          <Cell caption="no children, no rawHtml">
            <Prose />
          </Cell>
          <Cell caption="whitespace children">
            <Prose> </Prose>
          </Cell>
        </Block>

        <Block title="Invalid variant or size → the dev-only red error box. Suppressed on a production build, so these are empty there.">
          <Cell caption='variant="fancy"'>
            <Prose variant={"fancy" as ProseVariant}>
              <p>Unreachable.</p>
            </Prose>
          </Cell>
          <Cell caption='size="xl"'>
            <Prose size={"xl" as ProseSize}>
              <p>Unreachable.</p>
            </Prose>
          </Cell>
        </Block>
      </Section>
    </>
  );
}
