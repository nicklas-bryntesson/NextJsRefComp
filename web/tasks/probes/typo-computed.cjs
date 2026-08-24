/* typo-computed.cjs — the step-3 safety net for the typographic pair.
 *
 * Modelled on button-computed.cjs, which explains the reasoning: the Razor
 * primitive set has NO conformance suite, so a Tailwind conversion has nothing
 * structural to fall back on and the only question that matters is "did any
 * computed value change?".
 *
 * Prose makes that harder than Button did. Button owns every element it styles,
 * so a snapshot of `.Button` + two parts covers it. Prose styles DESCENDANTS —
 * `p`, `h1`–`h6`, `li`, `blockquote`, `code`, `pre`, `th`, `td`, `figcaption`,
 * `hr`, `a` — none of which Prose renders. So this probe walks every styled
 * descendant of every `.Prose` and keys it by tag + ordinal within its
 * container. That is the ONLY way to see a Tailwind conversion of Prose at all,
 * and it is also the measurement that answers whether such a conversion is
 * possible: an element Prose does not render cannot receive a utility class.
 *
 * Usage:
 *   node tasks/probes/typo-computed.cjs <save|diff> <file> [heading|prose]
 *
 * Exit 0 = identical (diff mode).
 */
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3210';

/* Everything typography carries, plus the box properties a restyle moves. */
const TYPE_PROPS = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'word-spacing', 'font-feature-settings', 'font-variant-numeric',
  'text-transform', 'text-align', 'text-wrap-mode', 'text-wrap-style',
  'text-decoration-line', 'text-decoration-thickness', 'text-underline-offset',
  'color', 'background-color', 'opacity',
  'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'border-top-width', 'border-left-width', 'border-bottom-width',
  'border-left-color', 'border-bottom-color', 'border-radius',
  'overflow-x', 'overflow-wrap', 'word-break', 'width', 'display',
  'text-box-trim', 'text-box-edge',
];

/* The elements `Prose.css` has a rule for. `caption`, `thead` and `tbody` are
 * NOT in the stylesheet and are excluded deliberately — including them would
 * make the snapshot larger without making it stricter. */
const PROSE_DESCENDANTS =
  'p, h1, h2, h3, h4, h5, h6, ul, ol, li, em, i, strong, b, a, code, blockquote, pre, table, th, td, figure, figcaption, hr';

async function measure(which) {
  const route = which === 'prose' ? '/primitives/prose' : '/primitives/heading';
  const browser = await chromium.launch();
  const out = {};
  for (const appearance of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    /* Zero the duration rather than `transition: none`, for the reason
       button-computed.cjs documents: `transition: none` also resets
       transition-property, hiding a dropped transition. */
    await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}' });
    /* Fonts must be loaded before any font-size / line-height is read: a
       fallback face changes nothing about the computed numbers but DOES change
       `font-family`'s resolution order in some engines, and `text-wrap: balance`
       re-breaks lines when the real metrics land, which moves heights. */
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    out[appearance] = await page.evaluate(({ TYPE_PROPS, PROSE_DESCENDANTS, which }) => {
      const pick = (el) => {
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of TYPE_PROPS) o[p] = cs.getPropertyValue(p);
        return o;
      };
      const result = {};
      const seen = {};
      const key = (parts) => {
        let k = parts.filter(Boolean).join(' ~ ');
        seen[k] = (seen[k] || 0) + 1;
        if (seen[k] > 1) k += ` #${seen[k]}`;
        return k;
      };

      if (which === 'prose') {
        for (const root of document.querySelectorAll('.Prose')) {
          const axes = `${root.dataset.variant}/${root.dataset.size}/${root.tagName.toLowerCase()}`;
          result[key(['.Prose', axes])] = pick(root);
          /* Every styled descendant, in document order, keyed by tag + ordinal
             within THIS container so a key survives a reordering elsewhere. */
          const counts = {};
          for (const el of root.querySelectorAll(PROSE_DESCENDANTS)) {
            const tag = el.tagName.toLowerCase();
            counts[tag] = (counts[tag] || 0) + 1;
            result[key([axes, `${tag}[${counts[tag]}]`])] = pick(el);
          }
        }
      } else {
        for (const el of document.querySelectorAll('.Heading')) {
          const axes = [...el.attributes]
            .filter((a) => a.name.startsWith('data-'))
            .map((a) => `${a.name}=${a.value}`)
            .sort()
            .join('|');
          const tag = el.tagName.toLowerCase();
          const label = (el.textContent || '').trim().slice(0, 28);
          const k = key([tag, label, axes]);
          result[k] = pick(el);
          const inner = el.querySelector(':scope > .heading-text, :scope > .heading-link');
          if (inner) result[k + ' → inner'] = pick(inner);
          const mark = el.querySelector('mark');
          if (mark) result[k + ' → mark'] = pick(mark);
        }
      }
      return result;
    }, { TYPE_PROPS, PROSE_DESCENDANTS, which });
    await page.close();
  }
  await browser.close();
  return out;
}

(async () => {
  const [mode, file, which = 'heading'] = process.argv.slice(2);
  if (!mode || !file) {
    console.error('usage: typo-computed.cjs <save|diff> <file> [heading|prose]');
    process.exit(2);
  }
  const now = await measure(which);
  const count = Object.keys(now.light).length;

  if (mode === 'save') {
    fs.writeFileSync(file, JSON.stringify(now, null, 1));
    console.log(`saved ${count} element(s) × 2 appearances × ${TYPE_PROPS.length} props → ${file}`);
    process.exit(0);
  }

  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  let diffs = 0, missing = 0, added = 0;
  for (const appearance of ['light', 'dark']) {
    const a = before[appearance], b = now[appearance];
    for (const k of Object.keys(a)) {
      if (!b[k]) { console.log(`GONE   [${appearance}] ${k}`); missing++; continue; }
      for (const prop of Object.keys(a[k])) {
        if (a[k][prop] !== b[k][prop]) {
          console.log(`DIFF   [${appearance}] ${k}\n         ${prop}: "${a[k][prop]}" → "${b[k][prop]}"`);
          diffs++;
        }
      }
    }
    for (const k of Object.keys(b)) if (!a[k]) { console.log(`NEW    [${appearance}] ${k}`); added++; }
  }
  console.log(`\n${count} element(s) measured. ${diffs} property diff(s), ${missing} gone, ${added} new.`);
  process.exit(diffs + missing + added === 0 ? 0 : 1);
})();
