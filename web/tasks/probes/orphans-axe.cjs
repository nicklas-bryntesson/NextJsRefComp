/* orphans-axe.cjs — axe over the three orphan-stylesheet routes, BOTH appearances.
 *
 * Adapted from button-axe.cjs. These three have no conformance suite AND no
 * TagHelper, so this probe plus orphans-reflow.cjs are the entire accessibility
 * net. A data table raises the stakes: caption, `th scope`, and a keyboard-
 * operable scroll region are all axe-visible, and the atomica11y criteria in
 * `reference-components/docs/atomica11y/main/table.md` add one that is not
 * (criterion 1: the table itself must NOT be focusable — see O-10).
 */
const { chromium } = require('playwright');
const guard = require('./orphans-guard.cjs');
const { injectAxe, getViolations } = require('axe-playwright');

const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/primitives/table', '/primitives/covercomposition', '/primitives/circlediagram'];

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const route of ROUTES) {
    for (const appearance of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto('http://localhost:3210' + route, { waitUntil: 'load' });
      await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
      await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      /* The video variant progressively enhances (native controls -> custom
         toggle), so wait for the enhancement to land before auditing: auditing
         mid-swap measures a tree that exists for one frame. */
      await page.waitForTimeout(500);
      await guard(page, { sentinelSelector: 'body', sentinelProperty: 'background-color', sentinelMustNotBe: 'rgba(0, 0, 0, 0)' });
      await injectAxe(page);
      const v = await getViolations(page, undefined, {
        axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
      });
      const n = v.reduce((s, x) => s + x.nodes.length, 0);
      total += n;
      console.log(`\n=== ${route} [${appearance.toUpperCase()}] - ${v.length} violation type(s), ${n} node(s) ===`);
      for (const x of v) {
        console.log(`  [${x.impact}] ${x.id}: ${x.help}  (${x.nodes.length} node(s))`);
        for (const node of x.nodes.slice(0, 4)) {
          console.log(`      ${node.target.join(' ')}`);
          const m = (node.failureSummary || '').split('\n').find((l) => /contrast|ratio|expected|Element/i.test(l));
          if (m) console.log(`        ${m.trim()}`);
        }
        if (x.nodes.length > 4) console.log(`      ... ${x.nodes.length - 4} more`);
      }
      await page.close();
    }
  }
  console.log(`\n${total === 0 ? 'NO WCAG 2 AA VIOLATIONS ON ANY ROUTE IN EITHER APPEARANCE' : total + ' failing node(s) total'}`);
  await browser.close();
  process.exit(total === 0 ? 0 : 1);
})();
