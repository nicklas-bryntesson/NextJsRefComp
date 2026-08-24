/* picture-reflow.cjs — WCAG 1.4.10 Reflow, 320–1280 px.
 *
 * Adapted from tasks/probes/button-reflow.cjs, plus a guard and one extra check
 * this component needs and Button did not: an `<img>` is a REPLACED element with
 * intrinsic dimensions, so it can overflow its container in ways nothing else on
 * a page can. `Media.css` bounds it with `width: 100%`, but that rule is scoped
 * to `.Media-picture` — and `TeaserTagHelper` passes `pictureClass: "Media"`, so
 * on that call path the rule matches nothing and the img falls back to intrinsic
 * width. Whether that overflows here depends on Tailwind's preflight
 * (`img,video{max-width:100%}`), which the Razor app does not have. So the probe
 * reports intrinsic-vs-box per image as well as document overflow.
 *
 * axe does not test reflow at all, so nothing else catches any of this.
 */
const { chromium } = require('playwright');
const { assertStyled } = require('./picture-guard.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3230';
const WIDTHS = [320, 360, 400, 480, 640, 768, 1024, 1280];
const ROUTES = process.argv.slice(2);

(async () => {
  const routes = ROUTES.length ? ROUTES : ['/primitives/picture'];
  const browser = await chromium.launch();
  let fails = 0;
  let wide = 0;

  for (const route of routes) {
    console.log(`\n=== ${route} ===`);
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(BASE + route, { waitUntil: 'load' });
      await assertStyled(page, `${width}px`);
      /* Load every image before measuring: an unloaded img is 0x0 and would hide
         exactly the overflow this probe is looking for. */
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

      const r = await page.evaluate(() => {
        const d = document.documentElement;
        const overflow = d.scrollWidth - d.clientWidth;
        const culprits = [];
        if (overflow > 0) {
          for (const el of document.querySelectorAll('*')) {
            const b = el.getBoundingClientRect();
            if (b.right > d.clientWidth + 1 && b.width > 0) {
              if (![...el.children].some((c) => c.getBoundingClientRect().right > d.clientWidth + 1)) {
                culprits.push({
                  sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
                    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
                  left: Math.round(b.left), right: Math.round(b.right),
                });
              }
            }
          }
        }
        /* Any img whose box exceeds the viewport, even if an ancestor clips it
           and the document therefore does not scroll. A clipped overflow is not
           a 1.4.10 failure but it IS a cropped image nobody asked for. */
        const overWide = [...document.images]
          .map((img) => {
            const b = img.getBoundingClientRect();
            const host = img.closest('[data-id]');
            return {
              id: host ? host.getAttribute('data-id') : '(none)',
              box: Math.round(b.width),
              natural: img.naturalWidth,
              maxWidth: getComputedStyle(img).maxWidth,
              cssWidth: getComputedStyle(img).width,
            };
          })
          .filter((i) => i.box > d.clientWidth + 1);
        return { overflow, culprits: culprits.slice(0, 5), overWide };
      });

      const ok = r.overflow <= 0;
      if (!ok) fails++;
      wide += r.overWide.length;
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${String(width).padStart(5)}px  document overflow ${r.overflow}px` +
        (r.overWide.length ? `   ${r.overWide.length} img wider than the viewport` : ''),
      );
      for (const c of r.culprits) console.log(`         ${c.sel}  (${c.left} → ${c.right})`);
      for (const i of r.overWide) {
        console.log(`         img in [${i.id}] box ${i.box}px, natural ${i.natural}px, max-width ${i.maxWidth}, width ${i.cssWidth}`);
      }
      await page.close();
    }
  }

  console.log(
    `\n${fails === 0 ? 'NO HORIZONTAL OVERFLOW AT ANY WIDTH' : fails + ' width(s) failed'}` +
    `${wide ? `; ${wide} img instance(s) wider than their viewport` : '; no img exceeded its viewport'}`,
  );
  await browser.close();
  process.exit(fails === 0 && wide === 0 ? 0 : 1);
})();
