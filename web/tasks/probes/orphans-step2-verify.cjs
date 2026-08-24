/* orphans-step2-verify.cjs — did the restyle land, and does it hold up?
 *
 * Three questions in one run:
 *  1. RESTYLE  — every property the step-1 probe measured as dead is now live,
 *                in BOTH appearances.
 *  2. CONTRAST — the ratios axe cannot reason about plus the ones it can, so the
 *                numbers are in the findings rather than only a pass/fail.
 *  3. COLLISION— how many elements a bare-`table` stylesheet would restyle if it
 *                were loaded on a route that renders reference components. Five
 *                of them render <table>. Injected, not imported: the point is to
 *                measure the blast radius without shipping it.
 */
const { chromium } = require('playwright');
const guard = require('./orphans-guard.cjs');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3210';

/* Colour maths. The first version of this probe parsed digits out of the computed
 * string with a regex, which silently produced NONSENSE the moment a value came
 * back as `oklch()` or `lab()` — Chromium returns the authored colour space for
 * `color-mix()` and `oklch()` results, and `lab(94.8 0.1 1.5)` read as "rgb(94,
 * 0, 1)". It reported a near-white heading on a near-black scrim as 1.48:1. So
 * every colour is resolved to sRGB by the browser itself, via a canvas, and a
 * translucent background is COMPOSITED over the ground beneath it rather than
 * being treated as opaque. Recorded because a wrong instrument that produces a
 * plausible number is worse than no instrument. F-092. */
async function resolve(page, colours) {
  return page.evaluate((list) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    return list.map((c) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = c;               // invalid colours leave the previous value
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    });
  }, colours);
}
function lumRGB([r, g, b]) {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** src over dst, both [r,g,b,a]. */
function over(src, dst) {
  const a = src[3];
  return [0, 1, 2].map((i) => src[i] * a + dst[i] * (1 - a)).concat(1);
}
function ratioRGB(fg, bg) {
  const a = lumRGB(fg), b = lumRGB(bg);
  return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2);
}

(async () => {
  const browser = await chromium.launch();
  const report = {};

  /* ── 1 + 2 ─────────────────────────────────────────────────────────────── */
  for (const appearance of ['light', 'dark']) {
    for (const [route, probe] of Object.entries({
      '/primitives/table': () => {
        const g = (s) => document.querySelector(s);
        const cs = (el) => el && getComputedStyle(el);
        const tbl = g('.table-scroll table'), th = g('thead th'), td = g('tbody td');
        const rowh = g('tbody th[scope="row"]'), cap = g('caption'), scroll = g('.table-scroll');
        const card = cs(document.querySelector('.kitchensink-section div[class*="bg-surface-card"]'));
        return {
          tableRadius: cs(tbl)['borderTopLeftRadius'] + ' / cell ' + cs(g('tbody tr:first-child td, tbody tr:first-child th'))?.borderTopLeftRadius,
          cellBorder: cs(td).borderLeftWidth + ' ' + cs(td).borderLeftColor,
          theadBand: cs(th).backgroundColor,
          theadColor: cs(th).color,
          tdColor: cs(td).color,
          rowHeaderHatch: cs(rowh).backgroundImage.slice(0, 60),
          captionColor: cs(cap).color,
          captionAlign: cs(cap).textAlign,
          scrollOverflowX: cs(scroll).overflowX,
          scrollTabIndex: scroll.getAttribute('tabindex'),
          tableTabIndex: tbl.getAttribute('tabindex'),
          tableOverflowX: cs(tbl).overflowX,
          _ratios: {
            'td text on card': [cs(td).color, getComputedStyle(document.body).backgroundColor],
            'th text on band': [cs(th).color, cs(th).backgroundColor],
            'caption on card': [cs(cap).color, getComputedStyle(document.body).backgroundColor],
            /* The Cell wrapper is transparent, so the ground has to be walked up
               to the actual card or the number is nonsense — the first version of
               this line measured the band against `rgba(0,0,0,0)` and reported
               1.07:1 in light and 17.44:1 in dark for the SAME pair of colours. */
            'band vs card (non-text, decorative)': [cs(th).backgroundColor, cs(document.querySelector('.table-scroll').closest('div[class*="bg-surface-card"]')).backgroundColor],
          },
        };
      },
      '/primitives/circlediagram': () => {
        const g = (s) => document.querySelector(s);
        const cs = (el) => el && getComputedStyle(el);
        const chart = g('.CircleDiagram-chart'), center = g('.CircleDiagram-center');
        const val = g('.CircleDiagram-legend-value'), lab = g('.CircleDiagram-legend-label');
        const sub = g('.CircleDiagram-subtitle'), fig = g('figure.CircleDiagram');
        const sw = [...document.querySelectorAll('.CircleDiagram-legend-swatch')].slice(0, 6);
        const cardBg = cs(g('.CircleDiagram').closest('div[class*="bg-surface-card"]')).backgroundColor;
        return {
          holeBg: cs(center).backgroundColor,
          figMarginInline: cs(fig).marginLeft,
          chartWidth: cs(chart).width,
          chartContainerType: cs(g('.CircleDiagram')).containerType,
          legendValueOpacity: cs(val).opacity,
          legendValueColor: cs(val).color,
          legendLabelColor: cs(lab).color,
          legendItemFontSize: cs(g('.CircleDiagram-legend-item')).fontSize,
          subtitleColor: cs(sub).color,
          swatches: sw.map((s) => cs(s).backgroundColor),
          chartAriaHidden: chart.getAttribute('aria-hidden'),
          _ratios: {
            'legend value on card': [cs(val).color, cardBg],
            'legend label on card': [cs(lab).color, cardBg],
            'subtitle on card': [cs(sub).color, cardBg],
          },
        };
      },
      '/primitives/covercomposition': () => {
        const g = (s) => document.querySelector(s);
        const cs = (el) => el && getComputedStyle(el);
        const media = g('.media-container'), ov = g('.overlay');
        const cc = g('.content-container'), inner = g('.content-container > div');
        const h = g('.CoverComposition-heading'), toggle = g('.video-toggle');
        return {
          mediaColorScheme: cs(media).colorScheme,
          mediaBg: cs(media).backgroundColor,
          overlayBg: cs(ov).backgroundColor,
          contentContainerGTC: cs(cc).gridTemplateColumns.slice(0, 70),
          contentContainerGap: cs(cc).columnGap,
          contentContainerPE: cs(cc).pointerEvents,
          innerClass: inner.className,
          innerPE: cs(inner).pointerEvents,
          innerDisplay: cs(inner).display,
          headingFontSize: cs(h).fontSize,
          headingFontWeight: cs(h).fontWeight,
          headingColor: cs(h).color,
          toggleColor: toggle && cs(toggle).color,
          toggleBg: toggle && cs(toggle).backgroundColor,
          toggleBorder: toggle && cs(toggle).borderTopColor,
          toggleAria: toggle && toggle.getAttribute('aria-label'),
          videoControls: g('video') && g('video').controls,
          videoState: g('[data-component="CoverCompositionVideo"]')?.getAttribute('data-video-state'),
          initialized: g('[data-component="CoverCompositionVideo"]')?.getAttribute('data-initialized'),
          _ratios: {
            /* The scrim is translucent, so the real ground is scrim-over-media.
               Measured against the two extremes a poster can present: pure white
               and pure black. If BOTH clear 4.5:1 the text is safe over any
               image, which is the only claim worth making about arbitrary CMS
               media. */
            'heading, scrim over WHITE media': [cs(h).color, cs(ov).backgroundColor, 'rgb(255,255,255)'],
            'heading, scrim over BLACK media': [cs(h).color, cs(ov).backgroundColor, 'rgb(0,0,0)'],
            'toggle icon, its own fill over WHITE media': [cs(toggle).color, cs(toggle).backgroundColor, 'rgb(255,255,255)'],
            'toggle icon, its own fill over BLACK media': [cs(toggle).color, cs(toggle).backgroundColor, 'rgb(0,0,0)'],
          },
        };
      },
    })) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(BASE + route, { waitUntil: 'load' });
      await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
      await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important}' });
      await page.waitForTimeout(600);
      await guard(page, { sentinelSelector: 'body', sentinelProperty: 'background-color', sentinelMustNotBe: 'rgba(0, 0, 0, 0)' });
      const r = await page.evaluate(probe);
      const ratios = {};
      for (const [k, spec] of Object.entries(r._ratios || {})) {
        /* [fg, bg] or [fg, bg, groundBeneathATranslucentBg] */
        const [fgS, bgS, groundS] = spec;
        const parts = await resolve(page, groundS ? [fgS, bgS, groundS] : [fgS, bgS]);
        const fg = parts[0];
        let bg = parts[1];
        if (bg[3] < 1) bg = over(bg, groundS ? parts[2] : [255, 255, 255, 1]);
        const composited = bg[3] < 1 || (groundS ? ' composited' : '');
        ratios[k] = `${ratioRGB(fg, bg)}:1  (${fgS} on ${bgS}${groundS ? ' over ' + groundS : ''}${composited ? '' : ''})`;
      }
      delete r._ratios;
      report[`${route} [${appearance}]`] = { ...r, ratios };
      await page.close();
    }
  }

  /* ── 3 · collision blast radius ─────────────────────────────────────────── */
  const css = fs.readFileSync('src/primitives/Table/Tables.css', 'utf8');
  for (const route of ['/kitchen-sink/datefield', '/kitchen-sink']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const before = await page.evaluate(() =>
      [...document.querySelectorAll('table, table *')].map((el) => {
        const c = getComputedStyle(el);
        return [c.borderTopWidth, c.borderLeftWidth, c.backgroundColor, c.padding, c.borderTopLeftRadius, c.color].join('|');
      }));
    await page.addStyleTag({ content: css });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() =>
      [...document.querySelectorAll('table, table *')].map((el) => {
        const c = getComputedStyle(el);
        return [c.borderTopWidth, c.borderLeftWidth, c.backgroundColor, c.padding, c.borderTopLeftRadius, c.color].join('|');
      }));
    const changed = before.filter((v, i) => v !== after[i]).length;
    const tables = await page.evaluate(() => document.querySelectorAll('table').length);
    const owners = await page.evaluate(() => [...new Set([...document.querySelectorAll('table')]
      .map((t) => { let n = t; while (n && !/^[A-Z]/.test((n.className || '').toString().split(' ')[0] || '')) n = n.parentElement; return n ? n.className.toString().split(' ')[0] : '(unowned)'; }))]);
    report[`COLLISION ${route}`] = {
      tablesOnRoute: tables, elementsInTables: before.length,
      elementsRestyled: changed,
      percent: before.length ? `${Math.round((changed / before.length) * 100)}%` : 'n/a',
      componentsOwningATable: owners,
    };
    await page.close();
  }

  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
