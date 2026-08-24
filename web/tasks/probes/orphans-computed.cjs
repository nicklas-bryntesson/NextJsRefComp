/* orphans-computed.cjs — the step-3 safety net for the three orphan stylesheets.
 *
 * There is NO conformance suite for the Razor primitive set, and these three
 * stylesheets do not even have a TagHelper to derive one from. So the Tailwind
 * conversion has nothing structural to fall back on and this probe is the whole
 * net: it walks every styled element on /primitives/table, /primitives/
 * covercomposition and /primitives/circlediagram, in BOTH appearances, and
 * records getComputedStyle.
 *
 * Modelled on button-computed.cjs, with one structural difference that matters:
 * `Tables.css` has NO CLASS NAMES, so instances cannot be keyed by `data-*` axes
 * the way a Button can. Table cells are keyed by a DOM PATH instead — table
 * ordinal, section, row index, cell index — which is the only stable identity an
 * element-level stylesheet offers. That is itself the finding F-062 asks about:
 * see findings/primitives-orphans.md O-13.
 *
 * Usage:
 *   node tasks/probes/orphans-computed.cjs save <file>
 *   node tasks/probes/orphans-computed.cjs diff <file>
 * Exit 0 = identical (diff mode).
 */
const fs = require('fs');
const { chromium } = require('playwright');
const guard = require('./orphans-guard.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3210';

const BOX = [
  'display', 'position', 'box-sizing',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-top-color', 'border-left-color', 'border-bottom-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'color', 'background-color', 'background-image',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-align', 'vertical-align', 'overflow-x', 'overflow-y',
  'width', 'height', 'inline-size', 'block-size',
  'box-shadow', 'opacity', 'z-index', 'pointer-events',
  'grid-template-columns', 'grid-row-start', 'grid-column-start', 'grid-column-end',
  'column-gap', 'row-gap', 'gap', 'flex-direction', 'align-items', 'justify-items',
  'caption-side', 'border-collapse', 'border-spacing', 'container-type',
  'object-fit', 'inset-block-start', 'inset-inline-end', 'list-style-type', 'flex-shrink',
];

/* What to measure per route. `key` is evaluated in the page and must produce a
 * stable identity for each match — for the class-less table sheet that is a DOM
 * path, everywhere else it is the class list. */
const TARGETS = {
  '/primitives/table': [
    'table', 'caption', 'thead th', 'tbody th', 'tbody td', 'tfoot th', 'tfoot td',
    '.table-scroll',
  ],
  '/primitives/covercomposition': [
    '.CoverComposition', '.media-container', '.overlay', '.content-container',
    '.content-container > div', '.CoverComposition-heading', '.Prose', '.link-group',
    '.video-controls', '.video-toggle', 'video', 'img',
    /* Added AFTER the step-2 snapshot was taken, so these carry no before/after
       coverage for the step-3 commit — they are here so the NEXT change to the
       hero is guarded. The CTA was verified against the step-2 CSS by hand:
       min-block-size 2.75rem, padding-inline var(--size-xl) which the bridge maps
       to --spacing-lg (24px, NOT Tailwind's --spacing-xl 32px — the first draft
       used `px-xl` and was 8px wide on each side). O-34. */
    '.CoverComposition-demoCta', '.CoverComposition-demoCta--quiet',
  ],
  '/primitives/circlediagram': [
    '.CircleDiagram', '.CircleDiagram-chart', '.CircleDiagram-center',
    '.CircleDiagram-caption', '.CircleDiagram-title', '.CircleDiagram-subtitle',
    '.CircleDiagram-legend', '.CircleDiagram-legend-item',
    '.CircleDiagram-legend-swatch', '.CircleDiagram-legend-label',
    '.CircleDiagram-legend-value',
  ],
};

async function measure() {
  const browser = await chromium.launch();
  const out = {};
  for (const appearance of ['light', 'dark']) {
    out[appearance] = {};
    for (const [route, selectors] of Object.entries(TARGETS)) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(BASE + route, { waitUntil: 'load' });
      await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
      /* Zero the DURATION, not `transition: none` — the latter also resets
         transition-property, so the snapshot could no longer see a transition
         being dropped by the conversion. Same reasoning as button-computed.cjs. */
      await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });
      /* Longer than any declared transition, because a Tailwind duration routed
         through --tw-duration can start before the override lands. */
      await page.waitForTimeout(400);
      await guard(page, { sentinelSelector: 'body', sentinelProperty: 'background-color', sentinelMustNotBe: 'rgba(0, 0, 0, 0)' });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

      out[appearance][route] = await page.evaluate(({ selectors, BOX }) => {
        /* A DOM path built from tag + nth-of-type up to <main>. This is the only
           identity a class-less stylesheet leaves us, and it breaks loudly if
           the DOM moves — which is what we want from a safety net. */
        const path = (el) => {
          const parts = [];
          let n = el;
          while (n && n.tagName && n.tagName.toLowerCase() !== 'main') {
            const tag = n.tagName.toLowerCase();
            const sibs = n.parentElement
              ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName)
              : [n];
            parts.unshift(sibs.length > 1 ? `${tag}[${sibs.indexOf(n) + 1}]` : tag);
            n = n.parentElement;
          }
          return parts.join('>');
        };
        const result = {};
        for (const sel of selectors) {
          const els = [...document.querySelectorAll(sel)];
          els.forEach((el) => {
            const cs = getComputedStyle(el);
            const o = {};
            for (const p of BOX) o[p] = cs.getPropertyValue(p);
            result[`${sel} @ ${path(el)}`] = o;
          });
        }
        return result;
      }, { selectors, BOX });
      await page.close();
    }
  }
  await browser.close();
  return out;
}

(async () => {
  const [mode, file] = process.argv.slice(2);
  if (!mode || !file) { console.error('usage: orphans-computed.cjs <save|diff> <file>'); process.exit(2); }
  const now = await measure();
  const count = Object.values(now.light).reduce((n, r) => n + Object.keys(r).length, 0);

  if (mode === 'save') {
    fs.writeFileSync(file, JSON.stringify(now, null, 1));
    console.log(`saved ${count} element(s) x 2 appearances -> ${file}`);
    process.exit(0);
  }

  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  let diffs = 0, gone = 0, added = 0;
  for (const appearance of ['light', 'dark']) {
    for (const route of Object.keys(before[appearance] || {})) {
      const a = before[appearance][route], b = (now[appearance] || {})[route] || {};
      for (const key of Object.keys(a)) {
        if (!b[key]) { console.log(`GONE   [${appearance}] ${route} ${key}`); gone++; continue; }
        for (const prop of Object.keys(a[key])) {
          if (a[key][prop] !== b[key][prop]) {
            console.log(`DIFF   [${appearance}] ${route} ${key}\n         ${prop}: "${a[key][prop]}" -> "${b[key][prop]}"`);
            diffs++;
          }
        }
      }
      for (const key of Object.keys(b)) if (!a[key]) { console.log(`NEW    [${appearance}] ${route} ${key}`); added++; }
    }
  }
  console.log(`\n${count} element(s) measured. ${diffs} property diff(s), ${gone} gone, ${added} new.`);
  process.exit(diffs + gone + added === 0 ? 0 : 1);
})();
