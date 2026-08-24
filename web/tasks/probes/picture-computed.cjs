/* picture-computed.cjs — the step-3 safety net.
 *
 * There is no conformance suite for the Razor primitive set, so the Tailwind
 * conversion has nothing structural to fall back on. This probe answers the only
 * question that matters for step 3: did any computed value change?
 *
 * It walks every figure/picture/img on /primitives/picture in BOTH appearances.
 * Instances are keyed by the nearest `data-id` host plus the picture's own class
 * list plus an ordinal, so the key survives a change that does not alter the
 * contract and breaks loudly on one that does.
 *
 * THE IMG PROPERTY LIST IS THE INTERESTING PART. For this component the
 * dangerous regressions are not colours, they are the four properties that
 * decide whether the layout reserves space and whether the image is distorted:
 * `aspect-ratio`, `object-fit`, `width`, `height`. A Tailwind conversion that
 * emits `w-full` in place of `width: 100%` is neutral; one that also picks up
 * preflight's `height: auto` where the stylesheet said `height: 100%` changes
 * the box model of every image on the site, silently and identically. Both are
 * one-character diffs in the source and the snapshot is what tells them apart.
 *
 * The `srcset`/`sizes`/`loading` ATTRIBUTES are snapshotted too, even though
 * they are not style: they are the whole contract of this component, no other
 * instrument in the project observes them, and a refactor of the preset table
 * would otherwise pass every gate. (picture-negotiate.cjs observes the browser's
 * CHOICE; this observes the offer.)
 *
 * Usage:
 *   node tasks/probes/picture-computed.cjs save <file>
 *   node tasks/probes/picture-computed.cjs diff <file>
 * Exit 0 = identical (diff mode).
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { assertStyled } = require('./picture-guard.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3230';
const ROUTE = '/primitives/picture';

const FIGURE_PROPS = [
  'display', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-left', 'border-top-width', 'border-left-width',
  'border-style', 'border-top-color', 'border-left-color', 'border-radius',
  'background-color', 'box-shadow', 'overflow-x', 'overflow-y', 'box-sizing',
  'width', 'height', 'position', 'isolation', 'contain', 'grid-template-columns',
];
const PICTURE_PROPS = [
  'display', 'position', 'overflow-x', 'overflow-y', 'border-radius',
  'aspect-ratio', 'width', 'height', 'background-color', 'box-shadow',
  'border-top-width', 'border-top-color', 'inset-block-start', 'contain',
];
const IMG_PROPS = [
  'display', 'width', 'height', 'max-width', 'max-height', 'min-height',
  'object-fit', 'object-position', 'aspect-ratio', 'position',
  'inset-block-start', 'inset-inline-start', 'border-radius', 'vertical-align',
  'background-color', 'color', 'font-size', 'font-family',
];
/* Not style, but the contract. See header. */
const IMG_ATTRS = ['src', 'srcset', 'sizes', 'loading', 'decoding', 'alt', 'width', 'height'];
const SOURCE_ATTRS = ['type', 'media', 'srcset', 'sizes'];

async function measure() {
  const browser = await chromium.launch();
  const out = {};
  for (const appearance of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(BASE + ROUTE, { waitUntil: 'load' });
    await assertStyled(page, appearance);
    await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });
    /* Every image loaded, or `width`/`height` on an unloaded img reads 0 and the
       snapshot records a layout that never existed. Scroll first — half the
       route is lazy. */
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    out[appearance] = await page.evaluate(
      ({ FIGURE_PROPS, PICTURE_PROPS, IMG_PROPS, IMG_ATTRS, SOURCE_ATTRS }) => {
        const pick = (el, props) => {
          if (!el) return null;
          const cs = getComputedStyle(el);
          const o = {};
          for (const p of props) o[p] = cs.getPropertyValue(p);
          return o;
        };
        const attrs = (el, names) => {
          if (!el) return null;
          const o = {};
          for (const n of names) o[n] = el.getAttribute(n);
          return o;
        };
        const result = {};
        const seen = {};
        for (const fig of document.querySelectorAll('figure')) {
          const host = fig.closest('[data-id]');
          const id = host ? host.getAttribute('data-id') : '(no-data-id)';
          for (const pic of fig.querySelectorAll('picture')) {
            const img = pic.querySelector('img');
            let key = `${id} ~ figure.${fig.className.trim().replace(/\s+/g, '.')} ~ picture.${pic.className.trim().replace(/\s+/g, '.')}`;
            seen[key] = (seen[key] || 0) + 1;
            if (seen[key] > 1) key += ` #${seen[key]}`;
            result[key] = {
              figure: pick(fig, FIGURE_PROPS),
              picture: pick(pic, PICTURE_PROPS),
              img: pick(img, IMG_PROPS),
              imgAttrs: attrs(img, IMG_ATTRS),
              sources: [...pic.querySelectorAll('source')].map((s) => attrs(s, SOURCE_ATTRS)),
            };
          }
        }
        return result;
      },
      { FIGURE_PROPS, PICTURE_PROPS, IMG_PROPS, IMG_ATTRS, SOURCE_ATTRS },
    );
    await page.close();
  }
  await browser.close();
  return out;
}

const flat = (obj, prefix = '') => {
  const o = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object') Object.assign(o, flat(v, `${prefix}${k}.`));
    else o[`${prefix}${k}`] = v;
  }
  return o;
};

(async () => {
  const [mode, file] = process.argv.slice(2);
  if (!mode || !file) {
    console.error('usage: picture-computed.cjs <save|diff> <file>');
    process.exit(2);
  }
  const now = await measure();
  const count = Object.keys(now.light).length;

  if (mode === 'save') {
    fs.writeFileSync(file, JSON.stringify(now, null, 1));
    console.log(`saved ${count} picture instance(s) × 2 appearances → ${file}`);
    process.exit(0);
  }

  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  let diffs = 0, missing = 0, added = 0;
  for (const appearance of ['light', 'dark']) {
    const a = before[appearance], b = now[appearance];
    for (const key of Object.keys(a)) {
      if (!b[key]) { console.log(`GONE   [${appearance}] ${key}`); missing++; continue; }
      const fa = flat(a[key]), fb = flat(b[key]);
      for (const prop of Object.keys(fa)) {
        if (fa[prop] !== fb[prop]) {
          console.log(`DIFF   [${appearance}] ${key}\n         ${prop}: "${fa[prop]}" → "${fb[prop]}"`);
          diffs++;
        }
      }
      for (const prop of Object.keys(fb)) if (!(prop in fa)) { console.log(`NEWPROP[${appearance}] ${key} ${prop} = "${fb[prop]}"`); diffs++; }
    }
    for (const key of Object.keys(b)) if (!a[key]) { console.log(`NEW    [${appearance}] ${key}`); added++; }
  }
  console.log(`\n${count} picture instance(s) measured. ${diffs} diff(s), ${missing} gone, ${added} new.`);
  process.exit(diffs + missing + added === 0 ? 0 : 1);
})();
