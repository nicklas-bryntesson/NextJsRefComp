const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:3200/primitives/button', { waitUntil: 'load' });
  await p.evaluate(()=>document.documentElement.setAttribute('data-appearance','dark'));
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.Button[data-emphasis="primary"]' });
  const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
  for (const r of m.matchedCSSRules || []) {
    const txt = r.rule.style.cssText || '';
    if (/background-color|--color-primary/.test(txt)) {
      console.log('SEL', r.rule.selectorList.text, '=>', txt.slice(0,200));
    }
  }
  await b.close();
})();
