const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://localhost:3200/primitives/button', { waitUntil: 'load' });
  console.log(await p.evaluate(() => {
    const out = [];
    for (const el of [...document.querySelectorAll('.Button[data-icon]')].slice(0, 3)) {
      const svg = el.querySelector('.Button-icon');
      const cs = getComputedStyle(svg);
      out.push({
        btn: el.getBoundingClientRect().width,
        iconRect: svg.getBoundingClientRect().width + 'x' + svg.getBoundingClientRect().height,
        inlineSize: cs.inlineSize, width: cs.width, maxWidth: cs.maxWidth,
        blockSize: cs.blockSize, aspect: cs.aspectRatio,
        hasViewBox: svg.hasAttribute('viewBox'),
        intrinsic: (() => { try { return svg.getBBox ? 'bbox' : ''; } catch (e) { return 'err'; } })(),
      });
    }
    return out;
  }));
  await b.close();
})();
