const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:3200/primitives/button', { waitUntil: 'load' });
  for (const app of ['light','dark']) {
    await p.evaluate((a)=>document.documentElement.setAttribute('data-appearance',a), app);
    console.log(app, await p.evaluate(() => {
      const root = document.documentElement;
      const btn = document.querySelector('.Button[data-emphasis="primary"]');
      const block = document.querySelector('.bg-surface-card');
      return {
        colorScheme: getComputedStyle(root).colorScheme,
        tokenPrimary: getComputedStyle(root).getPropertyValue('--color-primary'),
        btnBg: getComputedStyle(btn).backgroundColor,
        btnClasses: btn.className.slice(0,60),
        blockBg: block ? getComputedStyle(block).backgroundColor : null,
      };
    }));
  }
  await b.close();
})();
