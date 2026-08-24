/* picture-live-diag.cjs — throwaway: why does picture-live still move 170px
 * after step 2 reserved a box, when the other 22 pictures do not? */
const { chromium } = require('playwright');
const { assertStyled } = require('./picture-guard.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:3230';

(async () => {
  const browser = await chromium.launch();
  for (const block of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (block) await page.route('**/media/**', (r) => r.abort());
    await page.goto(BASE + '/primitives/picture', { waitUntil: 'load' });
    await assertStyled(page, block ? 'blocked' : 'loaded');
    if (!block) {
      await page.evaluate(async () => {
        const step = window.innerHeight / 2;
        for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r)); }
        window.scrollTo(0, 0);
      });
      await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
    }
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    const r = await page.evaluate(() => {
      const out = {};
      for (const id of ['picture-live', 'picture-hero']) {
        const host = document.querySelector(`[data-id="${id}"]`);
        const pic = host.querySelector('picture');
        const img = pic.querySelector('img');
        const pb = pic.getBoundingClientRect(), ib = img.getBoundingClientRect();
        out[id] = {
          hostW: Math.round(host.getBoundingClientRect().width),
          picBox: `${Math.round(pb.width)}x${Math.round(pb.height)}`,
          imgBox: `${Math.round(ib.width)}x${Math.round(ib.height)}`,
          imgAttrs: `${img.getAttribute('width')}x${img.getAttribute('height')}`,
          currentSrc: (img.currentSrc || '(none)').replace(/^.*\/media\//, ''),
          natural: `${img.naturalWidth}x${img.naturalHeight}`,
          cssAspect: getComputedStyle(img).aspectRatio,
          cssH: getComputedStyle(img).height,
          cssW: getComputedStyle(img).width,
          complete: img.complete,
          matchedSource: [...pic.querySelectorAll('source')]
            .filter((s) => !s.media || matchMedia(s.media).matches)
            .map((s) => `${s.type || 'orig'} ${s.media || '-'} ${s.getAttribute('width')}x${s.getAttribute('height')}`)
            .slice(0, 3),
          docScrollbar: window.innerWidth - document.documentElement.clientWidth,
        };
      }
      return out;
    });
    console.log(`\n=== images ${block ? 'BLOCKED' : 'LOADED'} ===`);
    for (const [id, v] of Object.entries(r)) {
      console.log(`  ${id}`);
      for (const [k, val] of Object.entries(v)) console.log(`     ${k.padEnd(15)} ${JSON.stringify(val)}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
