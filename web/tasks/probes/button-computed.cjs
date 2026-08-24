/* button-computed.cjs — the step-3 safety net.
 *
 * There is NO conformance suite for the Razor primitive set. The 405-assertion
 * net that guarded the reference-components ports does not exist here, so the
 * Tailwind conversion (step 3) has nothing structural to fall back on: it moves
 * design values off a stylesheet and onto utilities, and the only question that
 * matters is "did any computed value change?". This probe answers exactly that.
 *
 * It walks every `.Button` and `.CtaButton` on /primitives/button, in BOTH
 * appearances, and records getComputedStyle for three elements per instance —
 * the root, `.Button-text` / `.CtaButton-text`, and `.Button-icon` /
 * `.CtaButton-icon`. Instances are keyed by their own `data-*` axes plus an
 * ordinal, so the key survives a DOM change that does not change the contract
 * and breaks loudly on one that does.
 *
 * Usage:
 *   node tasks/probes/button-computed.cjs save <file>    snapshot
 *   node tasks/probes/button-computed.cjs diff <file>    re-measure and compare
 *
 * Exit code 0 = identical (diff mode). Non-zero = a property moved.
 */
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3200';
const ROUTE = '/primitives/button';

/* The properties that carry design. Layout properties are included because the
 * step-2 restyle changes padding and height, and step 3 must not change them
 * again. `transition` is included because Button.css declares it on the root and
 * a utility conversion is very likely to drop it silently. */
const ROOT_PROPS = [
  'display', 'grid-template-columns', 'grid-template-areas', 'align-items', 'gap',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-style', 'border-top-color', 'border-radius',
  'color', 'background-color', 'background-image', 'box-shadow',
  'outline-width', 'outline-style', 'outline-color', 'outline-offset',
  'text-decoration-line', 'cursor', 'box-sizing', 'transition',
  'width', 'height', 'font-size', 'white-space',
];
const TEXT_PROPS = [
  'grid-area', 'color', 'font-size', 'font-family', 'font-weight', 'line-height',
  'letter-spacing', 'margin-top', 'margin-bottom', 'word-break', 'overflow-wrap',
  'hyphens', 'position', 'z-index',
];
const ICON_PROPS = [
  'display', 'block-size', 'inline-size', 'width', 'max-width', 'position',
  'margin-top', 'margin-bottom', 'grid-area', 'color', 'z-index',
];

async function measure() {
  const browser = await chromium.launch();
  const out = {};
  for (const appearance of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + ROUTE, { waitUntil: 'load' });
    await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    /* Kill transitions. Button.css transitions colour over 250 ms, so a snapshot
       taken mid-transition on a `[data-test-state="hover"]` pin is a moving
       target — and the pins are applied at parse time, so the transition has
       ALREADY started by the time playwright's `load` resolves. */
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    out[appearance] = await page.evaluate(({ ROOT_PROPS, TEXT_PROPS, ICON_PROPS }) => {
      const pick = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs.getPropertyValue(p);
        return o;
      };
      const result = {};
      const seen = {};
      for (const el of document.querySelectorAll('.Button, .CtaButton')) {
        const isCta = el.classList.contains('CtaButton');
        /* Key from the contract surface: the element's own data-* axes, its
           label, and an ordinal for the rare exact duplicate. */
        const axes = [...el.attributes]
          .filter((a) => a.name.startsWith('data-') || a.name === 'aria-label' ||
                         a.name === 'type' || a.name === 'target' || a.name === 'rel')
          .map((a) => `${a.name}=${a.value}`)
          .sort()
          .join('|');
        const tag = el.tagName.toLowerCase();
        const label = (el.textContent || '').trim().slice(0, 24);
        const disabled = el.disabled ? 'disabled' : '';
        let key = [tag, disabled, label, axes].filter(Boolean).join(' ~ ');
        seen[key] = (seen[key] || 0) + 1;
        if (seen[key] > 1) key += ` #${seen[key]}`;
        result[key] = {
          root: pick(el, ROOT_PROPS),
          text: pick(el.querySelector(isCta ? '.CtaButton-text' : '.Button-text'), TEXT_PROPS),
          icon: pick(el.querySelector(isCta ? '.CtaButton-icon' : '.Button-icon'), ICON_PROPS),
        };
      }
      return result;
    }, { ROOT_PROPS, TEXT_PROPS, ICON_PROPS });
    await page.close();
  }
  await browser.close();
  return out;
}

(async () => {
  const [mode, file] = process.argv.slice(2);
  if (!mode || !file) {
    console.error('usage: button-computed.cjs <save|diff> <file>');
    process.exit(2);
  }
  const now = await measure();
  const count = Object.keys(now.light).length;

  if (mode === 'save') {
    fs.writeFileSync(file, JSON.stringify(now, null, 1));
    console.log(`saved ${count} instance(s) × 2 appearances × 3 elements → ${file}`);
    process.exit(0);
  }

  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  let diffs = 0, missing = 0, added = 0;
  for (const appearance of ['light', 'dark']) {
    const a = before[appearance], b = now[appearance];
    for (const key of Object.keys(a)) {
      if (!b[key]) { console.log(`GONE   [${appearance}] ${key}`); missing++; continue; }
      for (const part of ['root', 'text', 'icon']) {
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
