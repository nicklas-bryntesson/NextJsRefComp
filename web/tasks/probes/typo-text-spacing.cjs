/* typo-text-spacing.cjs — WCAG 2.1 SC 1.4.12 Text Spacing (AA), for the
 * typographic pair.
 *
 * The reference library ships a whole site-level suite for this
 * (`reference-components/tests/text-spacing.e2e.test.js`, ADR-0025: "the scale,
 * the family and the rhythm belong to the consuming project, but whether a
 * component SURVIVES the consumer's typography is mechanical"). The Razor
 * primitive set has no such suite, and a LONG-FORM PROSE COMPONENT is the single
 * place on this project where the criterion bites hardest — every one of the
 * four forced properties lands on an element Prose styles.
 *
 * This is that suite reduced to a probe, keeping the three things that make the
 * original honest and dropping the Playwright harness:
 *
 *  1. THE SELF-TEST. It plants a violation that cannot survive the overrides and
 *     fails if the detector misses it. Without this, a green survivability check
 *     is theatre: one over-broad exclusion and it passes while asserting nothing.
 *  2. THE CONTROL. It asserts the overrides actually applied and the page grew,
 *     so "nothing broke" cannot mean "nothing happened".
 *  3. THE BASELINE FILTER. Anything already clipped before the overrides is a
 *     pre-existing defect, not this criterion's; only newly-caused clipping is
 *     reported.
 *
 * Assertions, from the original: nothing is clipped, the page gains no
 * horizontal scroll, and interactive targets keep the 24px floor. Overlap is
 * deliberately not asserted — clipping is the honest proxy.
 *
 * Usage: node tasks/probes/typo-text-spacing.cjs [route …]
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3210';

/* The four overrides at the WCAG-recommended values, `!important` throughout —
 * which is what a user stylesheet or the standard bookmarklet does. */
const TEXT_SPACING = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, li, blockquote, figcaption {
    margin-block-end: 2em !important;
  }
`;

const INTENTIONAL = `
  (el) => {
    const cs = getComputedStyle(el)
    if (cs.clipPath && cs.clipPath !== 'none') return true
    const r = el.getBoundingClientRect()
    if (r.width <= 2 || r.height <= 2) return true
    /* A scroller is meant to scroll; that is not lost content. This is what
       exempts Prose's own <pre>, which carries overflow-x: auto by design. */
    if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY)) return true
    return false
  }
`;

const measure = (page) =>
  page.evaluate(([isIntentional]) => {
    const intentional = eval(isIntentional);
    const sections = [...document.querySelectorAll('section.kitchensink-section')];
    const clipped = [];
    const smallTargets = [];

    for (const section of sections) {
      const name = section.id || section.querySelector('h2')?.textContent?.trim() || '(unnamed)';
      for (const el of section.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;

        const hidden = /(hidden|clip)/.test(cs.overflowX + cs.overflowY);
        const hasText = (el.textContent ?? '').trim().length > 0;
        if (hidden && hasText && !intentional(el)) {
          const overX = el.scrollWidth - el.clientWidth;
          const overY = el.scrollHeight - el.clientHeight;
          if (overX > 1 || overY > 1) {
            clipped.push({
              section: name, tag: el.tagName.toLowerCase(),
              cls: el.className?.toString?.().slice(0, 40) ?? '', overX, overY,
            });
          }
        }

        if (el.matches('input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')) {
          /* WCAG 2.5.8's INLINE EXCEPTION, which the reference suite's version of
             this check does not implement: "the target is in a sentence, or its
             size is otherwise constrained by the line-height of non-target text".
             An inline link inside a paragraph is exactly that, and a long-form
             prose component is made of them — measured, this check reported three
             false positives at 320px on /primitives/prose, all of them inline
             links in the sample article at 78×20px. The exception is normative;
             without it the check cannot be run against prose at all. */
          const inline = /^inline($|-)/.test(cs.display) && !!el.closest('p, li, blockquote, td, th, figcaption, h1, h2, h3, h4, h5, h6');
          const r = el.getBoundingClientRect();
          if (!inline && r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 23) {
            smallTargets.push({ section: name, id: el.id || el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
      }
    }
    const d = document.documentElement;
    return {
      sectionCount: sections.length,
      docHeight: d.scrollHeight,
      hScroll: d.scrollWidth - d.clientWidth,
      lineHeight: getComputedStyle(document.body).lineHeight,
      letterSpacing: getComputedStyle(document.body).letterSpacing,
      clipped, smallTargets,
    };
  }, [INTENTIONAL]);

const key = (c) => `${c.section}/${c.tag}.${c.cls}`;

(async () => {
  const routes = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['/primitives/prose', '/primitives/heading'];
  const browser = await chromium.launch();
  let fails = 0;

  /* ── 0. The self-test. Runs once, on the first route. ─────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + routes[0], { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const section = document.querySelector('section.kitchensink-section');
      const bad = document.createElement('div');
      bad.className = 'planted-violation';
      /* `line-height: 1` on the plant is LOAD-BEARING, and getting it wrong is
         how this self-test first reported a false green. The reference suite
         plants a box pinned to the CURRENT line height and relies on the forced
         1.5 growing it — but this project's `globals.css` already sets
         `line-height: 1.5` on `body`, so forcing 1.5 changed nothing and the
         plant survived intact. A plant must be built to fail against THIS page's
         baseline, not against a generic one. */
      bad.style.cssText = 'overflow: hidden; inline-size: 40ch; line-height: 1';
      bad.textContent = 'One line, exactly.';
      section.appendChild(bad);
      /* Pinned from `scrollHeight`, not from `getBoundingClientRect().height`,
         and not from computed `lineHeight` (which can return the keyword
         `normal` — a valid computed value that does not resolve to px, so
         assigning it silently does nothing).
         `scrollHeight` is the one that makes the plant INTACT before the
         overrides, which the baseline filter requires. Measured: at
         `line-height: 1` the rendered box is 16px but scrollHeight is 18px
         because the descenders exceed the line box, so pinning the box to 16px
         made the plant ALREADY clipped by 2px — the baseline filter then
         discarded it and the self-test reported a false green. Exactly the
         mistake the reference suite's own comment warns about, reproduced from a
         different direction. */
      bad.style.blockSize = `${bad.scrollHeight}px`;
    });
    const before = await measure(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    const after = await measure(page);
    const baseline = new Set(before.clipped.map(key));
    const caused = after.clipped.filter((c) => !baseline.has(key(c)));
    const found = caused.some((c) => c.cls.includes('planted-violation'));
    console.log(`self-test: planted violation ${found ? 'DETECTED — the probe works' : 'MISSED — THE PROBE IS THEATRE'}`);
    if (!found) fails++;
    await page.close();
  }

  for (const route of routes) {
    console.log(`\n=== ${route} ===`);
    for (const width of [320, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(BASE + route, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const before = await measure(page);
      await page.addStyleTag({ content: TEXT_SPACING });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const after = await measure(page);

      /* The control. Without it the whole probe could pass by doing nothing. */
      const applied = after.letterSpacing !== before.letterSpacing;
      const grew = after.docHeight > before.docHeight;
      if (!applied || !grew) {
        console.log(`FAIL ${width}px  control: overrides applied=${applied} (ls ${before.letterSpacing} → ${after.letterSpacing}), page grew=${grew} (${before.docHeight} → ${after.docHeight}px)`);
        fails++;
      }

      const baseline = new Set(before.clipped.map(key));
      const caused = after.clipped.filter((c) => !baseline.has(key(c)));
      const tBase = new Set(before.smallTargets.map((t) => `${t.section}/${t.id}`));
      const tCaused = after.smallTargets.filter((t) => !tBase.has(`${t.section}/${t.id}`));
      const newScroll = after.hScroll > Math.max(0, before.hScroll);

      const ok = caused.length === 0 && tCaused.length === 0 && !newScroll && applied && grew;
      if (!ok && (caused.length || tCaused.length || newScroll)) fails++;
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${String(width).padStart(5)}px  ` +
        `sections ${after.sectionCount}, height ${before.docHeight}→${after.docHeight}px, ` +
        `h-scroll ${before.hScroll}→${after.hScroll}px, ` +
        `clipping caused ${caused.length}, targets shrunk ${tCaused.length}` +
        (before.clipped.length ? `  [${before.clipped.length} pre-existing clip(s) filtered out]` : ''),
      );
      for (const c of caused.slice(0, 6)) console.log(`         CLIPPED ${c.section} ${c.tag}.${c.cls}  +${c.overX}×${c.overY}px`);
      for (const t of tCaused.slice(0, 6)) console.log(`         TARGET  ${t.section} ${t.id}  ${t.w}×${t.h}px`);
      await page.close();
    }
  }

  console.log(`\n${fails === 0 ? 'WCAG 1.4.12 SURVIVED at every width, on every route' : fails + ' failure(s)'}`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
