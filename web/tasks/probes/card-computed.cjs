/* card-computed.cjs — the step-3 safety net for the Card port.
 *
 * Same instrument as button-computed.cjs, same reason: there is NO conformance
 * suite for the Razor primitive set, so the Tailwind conversion has nothing
 * structural to fall back on and "did any computed value change?" is the only
 * question that can be answered mechanically.
 *
 * TWO DIFFERENCES FROM THE BUTTON PROBE, both because Card is a different shape.
 *
 * 1. CARD HAS NO PARTS. `Card.css` styles the root and nothing else — there is
 *    no `.Card-header` or `.Card-body`. So this probe measures one element per
 *    instance instead of three. It also measures the FIRST ELEMENT CHILD of each
 *    card, which is not a Card part at all: it is the only way to see whether an
 *    inherited value (colour, font) changed under the conversion, and inheritance
 *    is exactly what a utility on the root can silently alter.
 *
 * 2. THE KEY INCLUDES THE ELEMENT NAME. `element` is one of Card's four axes and
 *    it is NOT reflected in any `data-*` attribute — the only trace of it is the
 *    tag name. A key built from `data-*` alone would collapse the four element
 *    variants onto one entry and stop being able to see three of them.
 *
 * Also measured: `overflow`, because `Card.css`'s `overflow: hidden` is what
 * clips Teaser's full-bleed media to the frame's radius, and it is the single
 * declaration whose silent loss would break a component that is not on this page.
 *
 * Usage:
 *   node tasks/probes/card-computed.cjs save <file>
 *   node tasks/probes/card-computed.cjs diff <file>
 *
 * Exit code 0 = identical (diff mode). Non-zero = a property moved.
 */
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3200';
const ROUTE = '/primitives/card';

const ROOT_PROPS = [
  'display', 'flex-direction', 'gap', 'row-gap', 'column-gap',
  'align-items', 'justify-content', 'overflow-x', 'overflow-y',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width',
  'border-left-width', 'border-top-style', 'border-top-color',
  'border-left-color', 'border-radius',
  'color', 'background-color', 'background-image', 'box-shadow',
  'box-sizing', 'margin-top', 'margin-bottom',
  'width', 'height', 'min-height', 'font-size', 'font-family', 'font-weight',
  'line-height', 'letter-spacing', 'transition', 'transition-property',
  'transition-duration', 'opacity', 'position', 'list-style-type',
];

/* Not a Card part — the child is measured only to catch a change in what the
 * root passes down by inheritance. */
const CHILD_PROPS = [
  'color', 'font-size', 'font-family', 'font-weight', 'line-height',
  'letter-spacing', 'width', 'height',
];

async function measure() {
  const browser = await chromium.launch();
  const out = {};
  for (const appearance of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + ROUTE, { waitUntil: 'load' });
    await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    /* `transition-duration: 0s`, NOT `transition: none` — see the long note in
       button-computed.cjs. `transition: none` also resets transition-property,
       which would make the snapshot unable to see a transition being dropped. */
    await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });
    /* And wait past the longest declared transition anyway. Card.css declares
       none, but the design tokens are `light-dark()` pairs and anything the
       kitchensink chrome transitions would otherwise be sampled mid-flight —
       which produced 518 phantom diffs on the Button port. */
    await page.waitForTimeout(400);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    out[appearance] = await page.evaluate(({ ROOT_PROPS, CHILD_PROPS }) => {
      const pick = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs.getPropertyValue(p);
        return o;
      };
      const result = {};
      const seen = {};
      for (const el of document.querySelectorAll('.Card')) {
        const axes = [...el.attributes]
          .filter((a) => a.name.startsWith('data-'))
          .map((a) => `${a.name}=${a.value}`)
          .sort()
          .join('|');
        /* The tag name is part of the contract here — `element` has no data-*
           reflection, so without it four axis values collapse to one key. */
        const tag = el.tagName.toLowerCase();
        const label = (el.textContent || '').trim().slice(0, 28);
        let key = [tag, label, axes].filter(Boolean).join(' ~ ');
        seen[key] = (seen[key] || 0) + 1;
        if (seen[key] > 1) key += ` #${seen[key]}`;
        result[key] = {
          root: pick(el, ROOT_PROPS),
          child: pick(el.firstElementChild, CHILD_PROPS),
        };
      }
      return result;
    }, { ROOT_PROPS, CHILD_PROPS });
    await page.close();
  }
  await browser.close();
  return out;
}

(async () => {
  const [mode, file] = process.argv.slice(2);
  if (!mode || !file) {
    console.error('usage: card-computed.cjs <save|diff> <file>');
    process.exit(2);
  }
  const now = await measure();
  const count = Object.keys(now.light).length;

  if (mode === 'save') {
    fs.writeFileSync(file, JSON.stringify(now, null, 1));
    console.log(`saved ${count} instance(s) × 2 appearances × 2 elements → ${file}`);
    process.exit(0);
  }

  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  let diffs = 0, missing = 0, added = 0;
  for (const appearance of ['light', 'dark']) {
    const a = before[appearance], b = now[appearance];
    for (const key of Object.keys(a)) {
      if (!b[key]) { console.log(`GONE   [${appearance}] ${key}`); missing++; continue; }
      for (const part of ['root', 'child']) {
        const pa = a[key][part], pb = b[key][part];
        if (!pa && !pb) continue;
        if (!pa || !pb) { console.log(`PART   [${appearance}] ${key} → ${part} ${pa ? 'removed' : 'added'}`); diffs++; continue; }
        for (const prop of Object.keys(pa)) {
          if (pa[prop] !== pb[prop]) {
            console.log(`DIFF   [${appearance}] ${key}\n         ${part}.${prop}: "${pa[prop]}" → "${pb[prop]}"`);
            diffs++;
          }
        }
      }
    }
    for (const key of Object.keys(b)) if (!a[key]) { console.log(`NEW    [${appearance}] ${key}`); added++; }
  }
  console.log(`\n${count} instance(s) measured. ${diffs} property diff(s), ${missing} gone, ${added} new.`);
  process.exit(diffs + missing + added === 0 ? 0 : 1);
})();
