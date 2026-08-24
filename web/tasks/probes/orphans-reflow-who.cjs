/* Name every element wider than the viewport, innermost-first. The generic
 * culprit finder in orphans-reflow.cjs only reports boxes whose RIGHT edge is
 * past the viewport; an element that is too WIDE but starts at a negative left
 * offset, or one inside an `overflow: hidden` ancestor, escapes it. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const route of process.argv.slice(2)) {
    for (const width of [320, 480]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      await p.goto('http://localhost:3210' + route, { waitUntil: 'load' });
      await p.waitForTimeout(400);
      const r = await p.evaluate((vw) => {
        const d = document.documentElement;
        const out = { overflow: d.scrollWidth - d.clientWidth, wide: [] };
        for (const el of document.querySelectorAll('*')) {
          const bb = el.getBoundingClientRect();
          if (bb.width > d.clientWidth + 1 || bb.right > d.clientWidth + 1) {
            const kids = [...el.children].some((c) => {
              const k = c.getBoundingClientRect();
              return k.width > d.clientWidth + 1 || k.right > d.clientWidth + 1;
            });
            if (!kids) out.wide.push({
              sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
              w: Math.round(bb.width), l: Math.round(bb.left), r: Math.round(bb.right),
              text: (el.textContent || '').trim().slice(0, 30),
            });
          }
        }
        return out;
      }, width);
      console.log(`\n${route} @ ${width}px — document overflow ${r.overflow}px`);
      for (const x of r.wide.slice(0, 10)) console.log(`   ${x.sel.padEnd(38)} w=${x.w} l=${x.l} r=${x.r}  "${x.text}"`);
      await p.close();
    }
  }
  await b.close();
})();
