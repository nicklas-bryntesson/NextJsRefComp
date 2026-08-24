/* button-axe.cjs — axe over /primitives/button in BOTH appearances.
 *
 * Adapted from tasks/probes/axe-dark.cjs, which is the working model for this.
 * The Razor primitive set has NO conformance suite, so there is no
 * component-scoped axe run to lean on: this probe and button-reflow.cjs are the
 * entire accessibility net for these components.
 *
 * Original header follows.
 *
 * Run axe over the whole kitchensink in BOTH appearances.
 * The component suites all run in the default (light) appearance, so a dark
 * half that fails contrast ships completely unnoticed — the exact failure mode
 * ADR-0021 records: "a token that never gained a dark half simply stays light
 * while everything around it flips", invisible to any structural test. */
const { chromium } = require('playwright');
const { injectAxe, getViolations } = require('axe-playwright');

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const appearance of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.goto('http://localhost:3200/primitives/button');
    await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });

    /* Nothing on this route progressively enhances — the whole Button family
       ports to Server Components that only compute attributes — so the
       ScrollArea measurement gate the page-level probe needs does not apply.
       Two frames is enough to settle fonts and the `data-test-state` pins.
       Transitions are killed above, which matters here: Button.css transitions
       colour over 250ms and the pins are live at parse time, so an audit that
       started immediately would sample a colour mid-fade. */
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await injectAxe(page);
    /* WCAG 1.4.3 exempts inactive components from the contrast minimum, and axe
       cannot see that exemption: a disabled AffixField renders its affix spans at
       opacity 0.5, and because they are plain <span>s rather than form controls
       axe reports them as failing body text. The component's own spec handles
       this by switching the `color-contrast` rule off for its whole section
       audit; excluding just the disabled subtrees is narrower and keeps the rule
       live everywhere else on the page. */
    const v = await getViolations(page, { exclude: [['[data-disabled="true"]']] }, {
      axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
    });
    /* Known Phase A defects: inherited VERBATIM from the reference stylesheet,
     * with a measured Phase B fix already identified. PORTING.md forbids editing
     * the copied CSS during Phase A ("Restyle to your own convention — after the
     * suite is green, never during"), so these cannot be fixed yet — but they
     * must not be silenced either, or this probe stops catching regressions in
     * the same rule. They are reported and counted separately.
     *
     * · FileUpload `.drop-label { opacity: 0.7 }` — 3.44:1 on the card, 3.23:1
     *   over the dragging tint. Dark passes at 4.59:1. FileUpload's own suite
     *   disables `color-contrast` in both of its axe runs, so the reference
     *   conformance suite is structurally blind to it. Phase B: opacity 0.9
     *   clears every ground (measured 5.51 / 5.02 / 6.60). Findings.md F-027. */
    /* No allowances. The reference-components probe carries a known-Phase-A
       exception for FileUpload's verbatim `.drop-label`; this route has none —
       step 2 restyled every colour in both stylesheets, so any violation here
       is ours. */
    const KNOWN_PHASE_A = [];
    const isKnown = (n) => KNOWN_PHASE_A.some((f) => f(n));

    console.log(`\n=== ${appearance.toUpperCase()} — ${v.length} violation type(s) ===`);
    for (const x of v) {
      const fresh = x.nodes.filter((n) => !isKnown(n));
      const known = x.nodes.length - fresh.length;
      if (known) console.log(`  [known Phase A] ${x.id}: ${known} node(s) inherited verbatim — see F-027`);
      if (!fresh.length) continue;
      total += fresh.length;
      console.log(`  [${x.impact}] ${x.id}: ${x.help}  (${fresh.length} node(s))`);
      for (const n of fresh.slice(0, 5)) {
        console.log(`      ${n.target.join(' ')}`);
        const m = (n.failureSummary || '').split('\n').find(l => /contrast|ratio/i.test(l));
        if (m) console.log(`        ${m.trim()}`);
      }
      if (fresh.length > 5) console.log(`      … ${fresh.length - 5} more`);
    }
    await page.close();
  }
  console.log(
    `\n${total === 0
      ? 'NO NEW WCAG 2 AA VIOLATIONS IN EITHER APPEARANCE (known Phase A defects listed above)'
      : total + ' new failing node(s) total'}`,
  );
  await browser.close();
  process.exit(total === 0 ? 0 : 1);
})();
