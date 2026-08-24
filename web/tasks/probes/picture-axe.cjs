/* picture-axe.cjs — axe over /primitives/picture in BOTH appearances.
 *
 * Adapted from tasks/probes/button-axe.cjs. The Razor primitive set has no
 * conformance suite, so this and picture-reflow.cjs are the entire accessibility
 * net for these components.
 *
 * WHAT AXE CAN AND CANNOT SEE HERE, which matters more for this component than
 * for any other in the set. axe's `image-alt` rule checks that an `<img>` has an
 * accessible name OR `alt=""`/`role="presentation"`. Both are satisfied by the
 * source's markup in every case — INCLUDING the case where the author simply
 * forgot the alt, because `PictureTagHelper` collapses a missing `alt` to `""`
 * and an empty alt is a valid declaration of "decorative". So a green
 * `image-alt` here means "every image declares an intent", not "every image
 * declares the RIGHT intent". The distinction is unmeasurable from the markup
 * and it is recorded as the port's principal accessibility finding.
 *
 * This probe therefore also prints an alt census — the thing axe cannot judge —
 * so the two are read side by side rather than the green being mistaken for a
 * verdict on alt quality.
 */
const { chromium } = require('playwright');
const { injectAxe, getViolations } = require('axe-playwright');
const { assertStyled } = require('./picture-guard.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3230';
const ROUTE = '/primitives/picture';

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  let census = null;

  for (const appearance of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + ROUTE, { waitUntil: 'load' });
    await assertStyled(page, appearance);
    await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });

    /* Scroll the page so the lazy images resolve. An <img> that has not loaded
       still has its alt attribute, so axe's verdict does not depend on this —
       but a broken image with no alt reads differently to a human reviewer, and
       the census below is more honest with everything loaded. */
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    await injectAxe(page);
    const v = await getViolations(page, null, {
      axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
    });

    /* No allowances. Step 2 restyles every colour on this route, so any
       violation here is ours. */
    console.log(`\n=== ${appearance.toUpperCase()} — ${v.length} violation type(s) ===`);
    for (const x of v) {
      total += x.nodes.length;
      console.log(`  [${x.impact}] ${x.id}: ${x.help}  (${x.nodes.length} node(s))`);
      for (const n of x.nodes.slice(0, 5)) {
        console.log(`      ${n.target.join(' ')}`);
        const m = (n.failureSummary || '').split('\n').find((l) => /contrast|ratio|alt/i.test(l));
        if (m) console.log(`        ${m.trim()}`);
      }
      if (x.nodes.length > 5) console.log(`      … ${x.nodes.length - 5} more`);
    }

    if (!census) {
      census = await page.evaluate(() =>
        [...document.images].map((img) => {
          const host = img.closest('[data-id]');
          return {
            id: host ? host.getAttribute('data-id') : '(none)',
            hasAlt: img.hasAttribute('alt'),
            alt: img.getAttribute('alt'),
            /* An empty alt makes the img `role=presentation` implicitly, which
               is what removes it from the accessibility tree. */
            decorative: img.getAttribute('alt') === '',
            broken: img.complete && img.naturalWidth === 0,
          };
        }),
      );
    }
    await page.close();
  }
  await browser.close();

  /* ── The census axe cannot produce ────────────────────────────────────── */
  const informative = census.filter((c) => c.alt);
  const decorative = census.filter((c) => c.decorative);
  const missing = census.filter((c) => !c.hasAlt);
  console.log(`\n=== alt census (${census.length} img elements) ===`);
  console.log(`  informative (non-empty alt): ${informative.length}`);
  console.log(`  decorative  (alt=""):        ${decorative.length}`);
  console.log(`  NO alt attribute at all:     ${missing.length}   <- axe WOULD catch these`);
  console.log(`  broken (naturalWidth 0):     ${census.filter((c) => c.broken).length}`);
  const byId = {};
  for (const c of census) (byId[c.id] ??= []).push(c.decorative ? 'alt=""' : c.hasAlt ? JSON.stringify(c.alt).slice(0, 46) : 'NO ALT');
  for (const [id, alts] of Object.entries(byId)) console.log(`    ${id.padEnd(30)} ${alts.join('  |  ')}`);
  console.log(
    '\n  NOTE: `picture-alt-decorative` (deliberate) and `picture-alt-omitted` (the\n' +
    '  author forgot) are BYTE-IDENTICAL in the markup above. That is the finding;\n' +
    '  axe passes both and cannot do otherwise.',
  );

  console.log(`\n${total === 0 ? 'NO WCAG 2 AA VIOLATIONS IN EITHER APPEARANCE' : total + ' failing node(s) total'}`);
  process.exit(total === 0 ? 0 : 1);
})();
