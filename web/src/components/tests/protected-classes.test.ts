/* THE GUARD THAT MAKES A TAILWIND PORT SURVIVABLE.
 *
 * ADR-0019 gives element parts deliberately generic single words — `.popup`,
 * `.trigger`, `.rail`, `.segment` — and invites a consumer to swap them for its
 * own utilities. The conformance suite then selects on those same words, so
 * "swap them" and "keep the suite green" are in direct conflict, and the failure
 * is the worst kind: a missing element reads as a STRUCTURAL defect, so you go
 * looking in the behaviour you just did not change.
 *
 * Phase B is exactly when that happens, because a translation's whole job is
 * rewriting class attributes. So the class names are pinned here, and the pin is
 * GENERATED from the contract by `scripts/protected-classes.mjs` — every class
 * the specs select on, plus every element class the component's own stylesheet
 * qualifies from its root. A hand-written list would drift on the next submodule
 * bump and read as coverage while covering nothing.
 *
 * Regenerate after a bump:  node scripts/protected-classes.mjs
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../protected-classes.json';

const SRC = join(process.cwd(), 'src');
const COMPONENTS = join(SRC, 'components');

/** Every class token this file could put on an element.
 *
 * ONLY `className` values. The first version of this scanned every string
 * literal, and it could not fail: a component's own code contains its parts as
 * SELECTORS — `querySelector('.popup')`, `closest('.segment')` — so the name
 * survived in the source while the class vanished from the DOM. Verified by
 * deliberately replacing `className="popup"` with utilities: the guard stayed
 * green. A guard that cannot fail is worse than no guard, because it certifies.
 */
function classTokens(src: string): Set<string> {
  const out = new Set<string>();
  let i = 0;
  while ((i = src.indexOf('className', i)) !== -1) {
    i += 'className'.length;
    /* `className=` on an element AND `className:` in an object that gets
       spread — MonthField and WeekField build their segment props in a helper
       that returns `{ className: 'segment', … }`, which is why the attribute
       form alone reported both as having lost `segment`. */
    while (/[\s=:]/.test(src[i])) i++;
    let region: string;
    if (src[i] === '{') {
      /* Brace-matched, so the array/template forms a translation uses are
         covered: className={[ "Notice", "grid …", className ].join(" ")}. */
      let depth = 0, j = i;
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) break;
      }
      region = src.slice(i, j + 1);
      i = j + 1;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i];
      const j = src.indexOf(q, i + 1);
      region = src.slice(i, j + 1);
      i = j + 1;
    } else continue;

    for (const [, , body] of region.matchAll(/(['"`])((?:[^\\\n`]|\\.)*?)\1/g)) {
      for (const t of body.split(/[\s{}]+/)) {
        if (/^[A-Za-z][A-Za-z0-9-]*$/.test(t)) out.add(t);
      }
    }
  }
  return out;
}

function tokensIn(dir: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/\.tsx?$/.test(f)) continue;
    for (const t of classTokens(readFileSync(join(dir, f), 'utf8'))) out.add(t);
  }
  return out;
}

describe('protected class names survive translation', () => {
  for (const [component, classes] of Object.entries(manifest.components)) {
    const dir = join(COMPONENTS, component);
    if (!existsSync(dir)) continue; // not ported yet
    it(`${component} still renders all ${(classes as string[]).length}`, () => {
      /* The KERNEL renders some of a component's parts: `WheelColumn` injects
         `.cylinder`, `.option` and `.band` into the wheel hosts the date
         fields author. That is ADR-0004's kernel exception, so the guard has
         to look there too — otherwise a component is marked as having lost a
         part it never authored in the first place. */
      const present = new Set([...tokensIn(dir), ...tokensIn(join(SRC, 'kernel'))]);
      const missing = (classes as string[]).filter((c) => !present.has(c));
      expect(
        missing,
        `${component} no longer renders ${missing.join(', ')} — the conformance ` +
          `suite selects on these, so a missing one fails as a structural defect`,
      ).toEqual([]);
    });
  }

  it(`the ${manifest.shared.length} cross-component names are rendered somewhere`, () => {
    const present = new Set<string>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else if (/\.tsx?$/.test(e.name))
          for (const t of classTokens(readFileSync(join(dir, e.name), 'utf8'))) present.add(t);
      }
    };
    walk(SRC);
    /* `Wheel` is injected by the kernel primitive rather than authored in JSX,
       so it is asserted against the kernel's own source too. */
    const missing = manifest.shared.filter((c: string) => !present.has(c));
    expect(missing).toEqual([]);
  });
});
