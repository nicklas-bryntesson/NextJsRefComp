/* picture-sizes-diag.cjs — throwaway: what `sizes` resolved to, and did my demo
 * width wrappers actually apply?
 *
 * `naturalWidth` is DENSITY-CORRECTED for a srcset selection, so it reports the
 * slot the browser computed rather than the file's pixel width. That makes it
 * useless for "which file did I get" and perfect for "what slot did `sizes`
 * promise". This probe separates the two: file bytes from the network log,
 * slot from naturalWidth, box from the layout.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3230';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const fetched = [];
  page.on('response', (r) => {
    if (/\/media\//.test(r.url())) fetched.push(r.url().replace(/^.*\/media\//, ''));
  });
  await page.goto(BASE + '/primitives/picture', { waitUntil: 'load' });
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});

  const out = await page.evaluate(() => {
    const rows = [];
    for (const id of ['picture-hero', 'picture-teaser', 'picture-classes-default', 'picture-classes-teaser']) {
      const host = document.querySelector(`[data-id="${id}"]`);
      const hcs = getComputedStyle(host);
      rows.push({
        id,
        wrapperClass: host.className,
        wrapperWidth: Math.round(host.getBoundingClientRect().width),
        wrapperCssWidth: hcs.width,
        wrapperMaxWidth: hcs.maxWidth,
        pics: [...host.querySelectorAll('picture')].map((pic) => {
          const img = pic.querySelector('img');
          const r = img.getBoundingClientRect();
          return {
            cls: pic.className,
            imgSizesAttr: img.getAttribute('sizes'),
            imgSrcsetAttr: img.getAttribute('srcset'),
            sourceSizes: [...pic.querySelectorAll('source')].map((s) => s.getAttribute('sizes')).join(','),
            currentSrc: (img.currentSrc || '').replace(/^.*\/media\//, ''),
            naturalSlot: img.naturalWidth,
            box: `${Math.round(r.width)}x${Math.round(r.height)}`,
            imgCssWidth: getComputedStyle(img).width,
            picDisplay: getComputedStyle(pic).display,
          };
        }),
      });
    }
    return rows;
  });
  await browser.close();

  for (const r of out) {
    console.log(`\n=== ${r.id}`);
    console.log(`  wrapper "${r.wrapperClass}" -> box ${r.wrapperWidth}px  css width ${r.wrapperCssWidth}  max-width ${r.wrapperMaxWidth}`);
    for (const p of r.pics) {
      console.log(`  picture .${p.cls}  display ${p.picDisplay}`);
      console.log(`     img sizes attr = ${JSON.stringify(p.imgSizesAttr)}   source sizes = ${p.sourceSizes}`);
      console.log(`     img srcset attr = ${p.imgSrcsetAttr ? 'present' : 'ABSENT (art direction)'}`);
      console.log(`     currentSrc ${p.currentSrc}   density-corrected slot ${p.naturalSlot}px   rendered box ${p.box}   img css width ${p.imgCssWidth}`);
    }
  }
  console.log(`\n=== bytes actually fetched (${fetched.length}) ===`);
  console.log('  ' + [...new Set(fetched)].sort().join('\n  '));
})();
