/* typo-teaser-markup.cjs — what the step-3 conversion does to a CONSUMER that
 * hand-writes the component's markup.
 *
 * `TagHelpers/TeaserTagHelper.cs` does not compose `app-heading` or `app-prose`.
 * It builds their markup as strings (lines 86-107):
 *
 *   <h2 class="Heading" data-variant="heading" data-size="4"
 *       data-align="left" data-wrap="balance">
 *     <span class="heading-text">…</span></h2>
 *   <div class="Prose" data-variant="basic" data-size="sm"><p>…</p></div>
 *
 * Both are pure class + data-attribute markup, which is exactly what the two
 * stylesheets were designed to style and exactly what a utility conversion
 * cannot reach. This probe injects Teaser's own strings into the live route and
 * measures what they render as — the honest answer to "is this port still usable
 * by its own consumer?".
 *
 * Run against a production server. Prints a table; not a gate.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3210';

const TEASER_HEADING =
  '<h2 class="Heading" data-variant="heading" data-size="4" data-align="left" data-wrap="balance">' +
  '<span class="heading-text">A teaser heading</span></h2>';
const TEASER_PROSE =
  '<div class="Prose" data-variant="basic" data-size="sm"><p>A teaser excerpt.</p></div>';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + '/primitives/heading', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  /* Two frames before reading anything. Without this the very first
     getComputedStyle after `load` intermittently returns UA defaults —
     16px/700/black on a fully-styled element — which reads exactly like "the
     conversion produced nothing" and cost one wrong conclusion here. */
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const r = await page.evaluate(({ TEASER_HEADING, TEASER_PROSE }) => {
    const host = document.createElement('div');
    host.innerHTML = TEASER_HEADING + TEASER_PROSE;
    document.querySelector('main').appendChild(host);

    const pick = (el) => {
      const c = getComputedStyle(el);
      return {
        fontSize: c.fontSize, lineHeight: c.lineHeight, fontWeight: c.fontWeight,
        letterSpacing: c.letterSpacing, color: c.color, display: c.display,
        fontFamily: c.fontFamily.split(',')[0],
      };
    };
    /* The reference: what the COMPONENT renders for the same axes. */
    const ref = [...document.querySelectorAll('.Heading[data-variant="heading"][data-size="4"]')]
      .find((el) => el !== host.querySelector('.Heading'));

    return {
      teaserHeadingRoot: pick(host.querySelector('.Heading')),
      teaserHeadingInner: pick(host.querySelector('.heading-text')),
      componentHeadingRoot: ref ? pick(ref) : null,
      componentHeadingInner: ref ? pick(ref.querySelector('.heading-text')) : null,
    };
  }, { TEASER_HEADING, TEASER_PROSE });

  /* Prose is measured on ITS OWN route. Each component imports its own
     stylesheet from its own module (globals.css deliberately imports none), so
     `Prose.css` is simply not in the chunk graph of /primitives/heading — the
     first version of this probe measured Teaser's Prose markup there and read
     16px where the `sm` gate specifies 14px, which looked like a Prose defect
     and was a probe defect. */
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page2.goto(BASE + '/primitives/prose', { waitUntil: 'load' });
  await page2.evaluate(() => document.fonts.ready);
  await page2.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const rp = await page2.evaluate(({ TEASER_PROSE }) => {
    const host = document.createElement('div');
    host.innerHTML = TEASER_PROSE;
    document.querySelector('main').appendChild(host);
    const pick = (el) => {
      const c = getComputedStyle(el);
      return { fontSize: c.fontSize, lineHeight: c.lineHeight, fontWeight: c.fontWeight,
               letterSpacing: c.letterSpacing, color: c.color, display: c.display };
    };
    const ref = [...document.querySelectorAll('.Prose[data-variant="basic"][data-size="sm"] p')]
      .find((el) => !host.contains(el));
    return { teaserProseP: pick(host.querySelector('.Prose p')), refProseP: ref ? pick(ref) : null };
  }, { TEASER_PROSE });
  r.teaserProseP = rp.teaserProseP;
  r.refProseP = rp.refProseP;

  const keys = ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'color', 'display'];
  console.log('\n=== Heading: Teaser hand-written markup vs the same axes via the component ===\n');
  console.log(['property', 'Teaser markup', 'component', 'same?'].map((s) => s.padEnd(22)).join(''));
  for (const k of keys) {
    const a = r.teaserHeadingRoot[k], b = r.componentHeadingRoot?.[k];
    console.log([k, a, b ?? '(no reference)', a === b ? 'yes' : 'NO'].map((s) => String(s).padEnd(22)).join(''));
  }
  console.log('\n.heading-text display: teaser', r.teaserHeadingInner.display,
              '| component', r.componentHeadingInner?.display);
  console.log('\n=== Prose: Teaser hand-written markup vs the component (stylesheet NOT converted) ===\n');
  console.log(['property', 'Teaser markup', 'component', 'same?'].map((s) => s.padEnd(22)).join(''));
  for (const k of keys) {
    const a = r.teaserProseP[k], b = r.refProseP?.[k];
    console.log([`p.${k}`, a, b ?? '(none)', a === b ? 'yes' : 'NO'].map((s) => String(s).padEnd(22)).join(''));
  }

  await browser.close();
})();
