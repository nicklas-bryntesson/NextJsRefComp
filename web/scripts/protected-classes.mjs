/* Generate the protected class-name manifest FROM THE CONTRACT.
 *
 * A hand-written list of "class names we must not remove" drifts the moment
 * upstream adds a selector, and a stale allow-list is worse than none — it reads
 * as coverage. So derive it: every element class the conformance suites select
 * on, plus every element class the component's own stylesheet qualifies from its
 * root. Re-run after a submodule bump.
 *
 *   node scripts/protected-classes.mjs            # write the manifest
 *   node scripts/protected-classes.mjs --print    # show it
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SUB = new URL('../../reference-components/', import.meta.url).pathname;
const COMPONENTS = join(SUB, 'src/partials/components');
const SITE_TESTS = join(SUB, 'tests');
const PARKED = new Set(['TabAccordion', 'Combobox']);

/* Class names that belong to the demo page or to a utility framework, not to a
   component's contract. Kept explicit so the manifest stays reviewable. */
const NOT_A_PART = new Set([
  'kitchensink-section', 'kitchensink', 'demo', 'container', 'wrapper',
  'notice-region', // rendered by NoticeRegion, not by Notice
  /* File extensions reached through a fixture name (`'.pdf'`, `'.txt'`),
     which survive the combinator rule because they start their string. */
  'pdf', 'txt', 'png', 'jpg', 'avif', 'webp', 'mp4', 'json', 'css', 'html',
]);

/** Element classes a spec selects on: `.foo` inside any quoted string. */
function fromSpec(src) {
  const out = new Set();
  /* Strip comments first — a commented-out selector is not a contract. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* Group 1 is the QUOTE, group 2 is the body. Destructuring `[, str]` binds
     the quote character, which contains no `.`, so every string was skipped
     and this function silently returned nothing — the manifest looked
     plausible because `fromCss` was carrying it alone. */
  for (const [, , str] of code.matchAll(/(['"`])((?:[^\\\n]|\\.)*?)\1/g)) {
    /* Only strings that look like selectors, so prose containing a full stop
       does not become a class name. */
    if (!/[.[#]/.test(str)) continue;
    /* Drop `${…}` interpolations: their contents are JavaScript, and a property
       access inside one reads as a class (`${el.className}` → `className`). */
    const sel = str.replace(/\$\{[^}]*\}/g, ' ');
    /* Both dialects of ADR-0019: PascalCase component roots and lowercase-kebab
       element parts. The root is the most-selected name in the whole suite.
       A class token may only follow the start of the string or a combinator —
       never an identifier character. That one condition rejects module paths
       (`target.js`), CDP method names (`Accessibility.getPartialAXTree`),
       fixture filenames (`sample.pdf`) and property accesses, all of which
       otherwise arrive as parts. */
    for (const [, cls] of sel.matchAll(/(?:^|[\s>+~,()[\]:])\.([A-Za-z][A-Za-z0-9-]*)/g)) {
      out.add(cls);
    }
  }
  return out;
}

/** Element classes the component's own CSS qualifies from its root. */
function fromCss(src, component) {
  const out = new Set();
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const chunk of code.split('{')) {
    const selector = (chunk.split('}').pop() ?? '').trim();
    if (!selector || selector.startsWith('@')) continue;
    /* Rooted at the component: `.Notice .icon`, `toggle-tip .arrow`,
       `.DateField[data-x] .popup`. The root itself is not an element class. */
    for (const part of selector.split(',')) {
      const m = part.trim();
      if (!new RegExp(`^(\\.${component}\\b|${component.toLowerCase().replace(/([a-z])([a-z]*)/, '')})`, 'i').test(m)
          && !m.toLowerCase().startsWith(`.${component.toLowerCase()}`)
          && !/^[a-z]+-[a-z]+\b/.test(m)) continue;
      for (const [, cls] of m.matchAll(/\s\.([a-z][a-z0-9-]*)/g)) out.add(cls);
    }
  }
  return out;
}

const manifest = {};
const shared = new Set();
const names = readdirSync(COMPONENTS).filter((d) => !PARKED.has(d)
  && existsSync(join(COMPONENTS, d, `${d}.md`)));

for (const name of names) {
  const dir = join(COMPONENTS, name);
  const spec = join(dir, 'tests', `${name}.e2e.test.js`);
  const css = join(dir, `${name}.css`);
  const set = new Set([
    ...(existsSync(spec) ? fromSpec(readFileSync(spec, 'utf8')) : []),
    ...(existsSync(css) ? fromCss(readFileSync(css, 'utf8'), name) : []),
  ]);
  for (const skip of NOT_A_PART) set.delete(skip);
  /* The root, always — but only where the root IS a class. ToggleTip's root is
     the custom element `toggle-tip`, so demanding a `.ToggleTip` class would
     invent a contract the library does not have. */
  const cssSrc = existsSync(css) ? readFileSync(css, 'utf8') : '';
  if (new RegExp(`\\.${name}\\b`).test(cssSrc)) set.add(name);
  /* A spec legitimately selects OTHER components' roots — ChoiceGroup's audits
     Notice and ChoiceField on the shared page. Those are contractual, but not
     THIS component's to render, so they go to `shared` and the per-component
     guard does not demand them here. */
  for (const cls of [...set]) {
    if (cls !== name && /^[A-Z]/.test(cls)) { shared.add(cls); set.delete(cls); }
  }
  manifest[name] = [...set].sort();
}

/* Site-level suites select across components; their classes are protected
   everywhere rather than attributed to one component. */
if (existsSync(SITE_TESTS)) {
  for (const f of readdirSync(SITE_TESTS).filter((f) => f.endsWith('.e2e.test.js'))) {
    for (const c of fromSpec(readFileSync(join(SITE_TESTS, f), 'utf8'))) shared.add(c);
  }
}
for (const skip of NOT_A_PART) shared.delete(skip);

const out = { generatedFrom: 'reference-components', shared: [...shared].sort(), components: manifest };

if (process.argv.includes('--print')) {
  const total = new Set([...shared, ...Object.values(manifest).flat()]).size;
  for (const [k, v] of Object.entries(manifest)) console.log(`${k.padEnd(15)} ${v.length.toString().padStart(2)}  ${v.join(' ')}`);
  console.log(`\nshared          ${shared.size.toString().padStart(2)}  ${[...shared].sort().join(' ')}`);
  console.log(`\n${total} distinct protected class names`);
} else {
  const dest = new URL('../src/components/protected-classes.json', import.meta.url).pathname;
  writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${dest}`);
}
