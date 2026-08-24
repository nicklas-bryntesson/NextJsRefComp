/* picture-cls.cjs — Cumulative Layout Shift on /primitives/picture.
 *
 * This is the component family most likely to cause CLS and nothing else in the
 * project measures it. `MediaHelper` emits NO `width`/`height` and no
 * `aspect-ratio`, on any of its images, in either mode — so until the bytes
 * arrive the browser has no ratio, the box is zero-height, and everything below
 * it moves. That is the layout-shift equivalent of PORTING.md's 300x150 SVG
 * warning, which the Button port hit for real.
 *
 * MEASURED UNDER LATENCY, AND THAT IS THE WHOLE POINT. Served from localhost off
 * an SSD, a 5 KB AVIF arrives inside the first frame and CLS reads 0.000 — a
 * false green that would have shipped the finding as "no problem found". The
 * shift is not absent, it is *outrun*. So the probe reports three conditions and
 * the interesting number is not the first one:
 *
 *   local     no throttling — what a naive measurement sees
 *   fast-4g   40 ms RTT
 *   slow-4g   300 ms RTT, 400 Kbps — a phone on a train
 *
 * `hadRecentInput` shifts are excluded, per the Core Web Vitals definition. The
 * probe also names the shifting nodes from `entry.sources`, because "the page
 * shifted 0.4" is not actionable and "the img inside picture-live moved 611 px"
 * is.
 *
 * Usage: node tasks/probes/picture-cls.cjs [route]
 */
const { chromium } = require('playwright');
const { assertStyled } = require('./picture-guard.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3230';
const ROUTE = process.argv[2] || '/primitives/picture';

const CONDITIONS = [
  { name: 'local', offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  { name: 'fast-4g', offline: false, latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  { name: 'slow-4g', offline: false, latency: 300, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 },
  /* THE CONDITION THAT ACTUALLY MATTERS, and the reason the three above all read
     0.000. Uniform throttling slows the render-blocking CSS *and* the images
     together, so the stylesheet arrives last and paint is deferred until after
     the hero has decoded — the CSS accidentally shields the page from its own
     layout shift. Slow the IMAGES ONLY and the shield is gone.
     This is not a contrived case for this component. Every URL `MediaHelper`
     emits is unique per crop x width x format, so a cold ImageSharp cache makes
     each of the hero's twelve candidates a first-request server-side resize.
     Image-slower-than-CSS is the NORMAL state for an Umbraco media pipeline, not
     the exotic one. */
  { name: 'image-lag', offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, imageDelayMs: 900 },
];

const OBSERVER = () => {
  window.__cls = 0;
  window.__shifts = [];
  const name = (n) => {
    if (!n || !n.tagName) return '(detached)';
    let el = n;
    const parts = [];
    while (el && el.tagName && parts.length < 4) {
      const id = el.getAttribute && el.getAttribute('data-id');
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '';
      parts.unshift(el.tagName.toLowerCase() + (id ? `[data-id=${id}]` : cls));
      if (id) break;
      el = el.parentElement;
    }
    return parts.join('>');
  };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls += e.value;
      window.__shifts.push({
        value: +e.value.toFixed(4),
        t: Math.round(e.startTime),
        sources: (e.sources || []).slice(0, 3).map((s) => ({
          node: name(s.node),
          from: `${Math.round(s.previousRect.width)}x${Math.round(s.previousRect.height)}@${Math.round(s.previousRect.top)}`,
          to: `${Math.round(s.currentRect.width)}x${Math.round(s.currentRect.height)}@${Math.round(s.currentRect.top)}`,
        })),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
};

/** Every `<picture>` on the route, keyed by its nearest `data-id` host, measured
 *  once with all media aborted and once with it loaded. */
async function measureReservedHeight() {
  const browser = await chromium.launch();
  const read = async (block) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    if (block) await page.route('**/media/**', (route) => route.abort());
    await page.goto(BASE + ROUTE, { waitUntil: 'load' });
    await assertStyled(page, block ? 'blocked' : 'loaded');
    if (!block) {
      /* Scroll so the lazy images actually load — this half is measuring
         final layout, not timing. */
      await page.evaluate(async () => {
        const step = window.innerHeight / 2;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => requestAnimationFrame(r));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
    }
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    const out = await page.evaluate(() =>
      [...document.querySelectorAll('picture')].map((pic, i) => {
        const host = pic.closest('[data-id]');
        return {
          key: `${host ? host.getAttribute('data-id') : '(no data-id)'}#${i}`,
          id: host ? host.getAttribute('data-id') : '(no data-id)',
          cls: (pic.className.replace(/Media(-picture)?/g, '').trim() || 'Media-picture'),
          h: Math.round(pic.getBoundingClientRect().height),
        };
      }),
    );
    await context.close();
    return out;
  };
  const blocked = await read(true);
  const loaded = await read(false);
  await browser.close();
  const byKey = Object.fromEntries(blocked.map((b) => [b.key, b.h]));
  return loaded.map((l) => ({
    id: l.id,
    cls: l.cls,
    blocked: byKey[l.key] ?? 0,
    loaded: l.h,
    delta: l.h - (byKey[l.key] ?? 0),
  }));
}

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const cond of CONDITIONS) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(OBSERVER);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    /* A warm HTTP cache means no image request at all and therefore no shift —
       the second run of any probe would read 0. Disable it explicitly rather
       than trusting a fresh context. */
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', cond);

    if (cond.imageDelayMs) {
      await page.route('**/media/**', async (route) => {
        await new Promise((r) => setTimeout(r, cond.imageDelayMs));
        await route.continue();
      });
    }

    await page.goto(BASE + ROUTE, { waitUntil: 'commit' });
    await page.waitForLoadState('load');
    await assertStyled(page, cond.name);

    /* Let every image settle, including the lazy ones, then let the observer
       flush. Scrolling is deliberately NOT done here: a scroll would make the
       lazy images load during a user-ish interaction and the shifts would be
       attributed differently. This measures the shift the page causes on its
       own, which is what the Core Web Vital reports. */
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1200)));

    const r = await page.evaluate(() => ({
      cls: +window.__cls.toFixed(4),
      shifts: window.__shifts,
      docH: document.documentElement.scrollHeight,
      /* How many images carry the two attributes that would prevent this. */
      imgs: [...document.images].length,
      withDims: [...document.images].filter((i) => i.hasAttribute('width') && i.hasAttribute('height')).length,
      withRatio: [...document.images].filter((i) => getComputedStyle(i).aspectRatio !== 'auto').length,
    }));
    results.push({ cond: cond.name, ...r });
    await context.close();
  }
  await browser.close();

  console.log(`route ${ROUTE}\n`);
  console.log('condition   CLS      verdict            docH    imgs  width+height  css aspect-ratio');
  for (const r of results) {
    /* Core Web Vitals thresholds: good <= 0.1, needs-improvement <= 0.25. */
    const verdict = r.cls <= 0.1 ? 'GOOD' : r.cls <= 0.25 ? 'NEEDS IMPROVEMENT' : 'POOR';
    console.log(
      `${r.cond.padEnd(11)} ${String(r.cls).padEnd(8)} ${verdict.padEnd(18)} ` +
      `${String(r.docH).padEnd(7)} ${String(r.imgs).padEnd(5)} ${String(r.withDims).padEnd(13)} ${r.withRatio}`,
    );
  }

  /* ── The deterministic half ───────────────────────────────────────────────
   *
   * CLS only counts a shift that happens IN THE VIEWPORT, so a page of lazy
   * images below the fold can read 0.000 while every one of them is primed to
   * move the moment it is scrolled to. That makes the CLS number necessary but
   * not sufficient, and reporting it alone would be the false green this whole
   * probe exists to avoid.
   *
   * So measure the mechanism instead of the symptom: load the page with every
   * media response ABORTED, record each picture's height, then load it normally
   * and record again. The delta is the height the layout does not reserve — the
   * shift each picture will contribute whenever it is visible, independent of
   * timing, cache and viewport. It is a property of the markup. */
  const reserved = await measureReservedHeight();
  console.log(`\n=== unreserved height per picture (images blocked vs loaded, 1280px) ===`);
  console.log('  data-id                       picture class        blocked -> loaded    unreserved');
  let totalUnreserved = 0;
  for (const p of reserved) {
    totalUnreserved += p.delta;
    console.log(
      `  ${p.id.padEnd(29)} ${p.cls.padEnd(20)} ${String(p.blocked).padStart(4)}px -> ${String(p.loaded).padStart(5)}px` +
      `      ${p.delta > 0 ? '+' + p.delta + 'px' : '0'}`,
    );
  }
  console.log(`  ${'—'.repeat(29)} ${' '.repeat(20)} ${' '.repeat(20)}      ${totalUnreserved}px total`);

  const worst = results.reduce((a, b) => (b.cls > a.cls ? b : a));
  console.log(`\n=== shift detail for the worst condition (${worst.cond}, ${worst.shifts.length} entries) ===`);
  for (const s of worst.shifts.slice(0, 12)) {
    console.log(`  +${String(s.value).padEnd(8)} @${String(s.t).padStart(5)}ms`);
    for (const src of s.sources) console.log(`      ${src.node}   ${src.from} -> ${src.to}`);
  }
  if (worst.shifts.length > 12) console.log(`  … ${worst.shifts.length - 12} more entries`);

  console.log(
    `\nworst CLS ${worst.cls} (${worst.cond}). ` +
    `${worst.withDims}/${worst.imgs} images carry width+height; ${worst.withRatio}/${worst.imgs} get an aspect-ratio from CSS.`,
  );
  /* Exit non-zero on a POOR result only. This probe is a measurement first — the
     step-1 number is EXPECTED to be bad, because the source emits no dimensions
     and step 1 is faithful. Step 2 is where it has to come down. */
  process.exit(worst.cls > 0.25 ? 1 : 0);
})();
