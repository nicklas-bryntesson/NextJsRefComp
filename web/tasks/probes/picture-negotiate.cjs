/* picture-negotiate.cjs — what the browser ACTUALLY picked.
 *
 * The whole contract of `MediaHelper` is a negotiation the browser performs from
 * markup: pick a format from the `<source type>` ladder, pick a crop from the
 * `<source media>` ladder, pick a width from the `srcset`/`sizes` pair. None of
 * that is style and none of it is semantics, so neither a computed-style
 * snapshot nor an axe run can see it, and there is no conformance suite for this
 * primitive set. This probe is the only instrument that observes the contract
 * being honoured.
 *
 * It reads `img.currentSrc`, which is the resolved candidate — the one property
 * that reports the outcome of all three choices at once.
 *
 * Usage: node tasks/probes/picture-negotiate.cjs
 */
const { chromium } = require('playwright');
const { assertStyled } = require('./picture-guard.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3230';
const ROUTE = '/primitives/picture';

/* The hero preset's breakpoints are 21.24999rem / 48rem / 64rem = 340 / 768 /
 * 1024 px at a 16px root. Sample either side of each, so a boundary that moves
 * is visible rather than merely absent. */
const VIEWPORTS = [320, 339, 341, 767, 769, 1023, 1025, 1440];

const TARGETS = [
  'picture-hero',
  'picture-teaser',
  'picture-classes-default',
  'picture-classes-teaser',
];

(async () => {
  const browser = await chromium.launch();
  const rows = {};

  for (const width of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(BASE + ROUTE, { waitUntil: 'load' });
    await assertStyled(page, `${width}px`);
    /* Lazy images below the fold never resolve a currentSrc, and the teaser
       preset is `loading="lazy"`. Scroll the whole page so every one enters the
       loading viewport, then wait for `complete`.
       NOT `img.decode()` — that hangs forever on an image the browser has
       deprioritised after it left the viewport again, which cost one 120 s
       timeout. `complete` is true for a 404 as well as a success, which is what
       we want: the MISSING fixture is supposed to fail. */
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
      }
      window.scrollTo(0, 0);
    });
    await page
      .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 })
      .catch(() => console.log(`  (warning: not every image reported complete at ${width}px)`));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    rows[width] = await page.evaluate((targets) => {
      const out = {};
      for (const id of targets) {
        const host = document.querySelector(`[data-id="${id}"]`);
        if (!host) { out[id] = null; continue; }
        out[id] = [...host.querySelectorAll('picture')].map((pic) => {
          const img = pic.querySelector('img');
          const r = img.getBoundingClientRect();
          return {
            pictureClass: pic.className,
            /* The file name is the whole answer: `<alias>-<width>.<ext>` encodes
               which crop, which width step and which format won. */
            picked: (img.currentSrc || '').replace(/^.*\/media\//, ''),
            natural: `${img.naturalWidth}x${img.naturalHeight}`,
            rendered: `${Math.round(r.width)}x${Math.round(r.height)}`,
            /* `undefined` here is the art-direction branch: no srcset on the img. */
            imgHasSrcset: img.hasAttribute('srcset'),
            sources: pic.querySelectorAll('source').length,
            loading: img.getAttribute('loading'),
            display: getComputedStyle(pic).display,
          };
        });
      }
      return out;
    }, TARGETS);
    await page.close();
  }
  await browser.close();

  let problems = 0;
  for (const id of TARGETS) {
    console.log(`\n=== ${id} ===`);
    for (const width of VIEWPORTS) {
      const pics = rows[width][id];
      if (!pics) { console.log(`  ${String(width).padStart(5)}px  MISSING`); problems++; continue; }
      for (const p of pics) {
        const cls = p.pictureClass.replace(/^Media(-picture)?\s*/, '') || '—';
        console.log(
          `  ${String(width).padStart(5)}px  ${cls.padEnd(18)}` +
          `${(p.picked || '(nothing)').padEnd(28)}` +
          `nat ${p.natural.padEnd(10)} rend ${p.rendered.padEnd(10)}` +
          `srcset-on-img ${String(p.imgHasSrcset).padEnd(6)} ${p.sources} src  ${p.loading}  ${p.display}`,
        );
        if (!p.picked) problems++;
      }
    }
  }
  /* ── What the `teaser` preset costs in bytes ──────────────────────────────
   *
   * The preset renders TWO complete <picture> elements and relies on the
   * consuming component to hide one (Teaser.css, via container queries). The
   * question that decides whether that is a reasonable design: does the hidden
   * one still download? `display: none` does NOT stop an image load in
   * Chromium — only `content-visibility` and lazy-loading-plus-offscreen do —
   * but that is worth measuring rather than asserting, because it is the
   * difference between "two elements, one image" and "two elements, two images"
   * on every teaser card on a listing page. */
  const b2 = await chromium.launch();
  const counts = {};
  for (const mode of ['both visible', 'StackedSources hidden', 'HorizontalSources hidden']) {
    const ctx = await b2.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const hits = new Set();
    p.on('response', (r) => { if (/\/media\/atrium\//.test(r.url())) hits.add(r.url().replace(/^.*\/media\//, '')); });
    if (mode !== 'both visible') {
      const hide = mode.split(' ')[0];
      await p.addStyleTag; // no-op guard for clarity
      await p.addInitScript((cls) => {
        document.addEventListener('DOMContentLoaded', () => {
          const s = document.createElement('style');
          s.textContent = `[data-id="picture-teaser"] .${cls}{display:none}`;
          document.head.appendChild(s);
        });
      }, hide);
    }
    await p.goto(BASE + ROUTE, { waitUntil: 'load' });
    await assertStyled(p, mode);
    /* Scroll it into view so the lazy loading is not what suppresses the fetch —
       the question is display:none, not loading="lazy". */
    await p.evaluate(() => document.querySelector('[data-id="picture-teaser"]').scrollIntoView());
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)));
    counts[mode] = [...hits].sort();
    await ctx.close();
  }
  await b2.close();

  console.log('\n=== what the two-picture `teaser` preset downloads (atrium only) ===');
  for (const [mode, files] of Object.entries(counts)) {
    console.log(`  ${mode.padEnd(26)} ${files.length} file(s): ${files.join(', ') || '(none)'}`);
  }

  console.log(`\n${problems === 0 ? 'every img resolved a candidate' : problems + ' img(s) resolved nothing'}`);
  process.exit(problems === 0 ? 0 : 1);
})();
