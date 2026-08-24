/* typo-reflow.cjs — WCAG 1.4.10 Reflow for the typographic pair.
 * Adapted from button-reflow.cjs; the original header follows.
 *
 * WCAG 1.4.10 Reflow — a standing viewport sweep.
 *
 * Content must reflow without two-dimensional scrolling down to 320 CSS px.
 * axe does not test reflow AT ALL, so no amount of green axe output says
 * anything about it — this needs a different instrument. Two seconds, and it
 * catches a class of failure the whole conformance suite is blind to.
 *
 * Suggested by the MotionRegion port after a fixed-width kitchensink demo put
 * 169 px of horizontal scroll on the shared page at 320 px.
 */
const { chromium } = require('playwright');

const WIDTHS = [320, 360, 480, 768, 1024, 1280];
const ROUTES = process.argv.slice(2);

(async () => {
  const routes = ROUTES.length ? ROUTES : ['/primitives/heading','/primitives/prose'];
  const browser = await chromium.launch();
  let fails = 0;

  for (const route of routes) {
    console.log(`\n=== ${route} ===`);
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`http://localhost:3210${route}`, { waitUntil: 'load' });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const r = await page.evaluate(() => {
        const d = document.documentElement;
        const overflow = d.scrollWidth - d.clientWidth;
        if (overflow <= 0) return { overflow, culprits: [] };
        // Name the innermost elements sticking out past the viewport, so a
        // failure points at a component instead of at "the page".
        const culprits = [];
        for (const el of document.querySelectorAll('*')) {
          const b = el.getBoundingClientRect();
          if (b.right > d.clientWidth + 1 && b.width > 0) {
            /* An element inside a scroll container is CLIPPED by it and does not
               contribute to document scrollWidth. Listing it sent one
               investigation down a dead end (three <code> elements reported as
               culprits while the real overflow came from two unstyled <pre>
               ancestors), so exclude it. */
            let anc = el.parentElement, inScroller = false;
            while (anc) {
              if (/auto|scroll/.test(getComputedStyle(anc).overflowX)) { inScroller = true; break; }
              anc = anc.parentElement;
            }
            if (inScroller) continue;
            if (![...el.children].some((c) => c.getBoundingClientRect().right > d.clientWidth + 1)) {
              culprits.push({
                sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
                  ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
                left: Math.round(b.left), right: Math.round(b.right),
              });
            }
          }
        }
        return { overflow, culprits: culprits.slice(0, 5) };
      });
      const ok = r.overflow <= 0;
      if (!ok) fails++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(width).padStart(5)}px  overflow ${r.overflow}px`);
      for (const c of r.culprits) console.log(`         ${c.sel}  (${c.left} → ${c.right})`);
      await page.close();
    }
  }

  console.log(`\n${fails === 0 ? 'NO HORIZONTAL OVERFLOW AT ANY WIDTH' : fails + ' width(s) failed'}`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
