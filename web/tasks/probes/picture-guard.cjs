/* picture-guard.cjs — refuse to measure an unstyled page.
 *
 * WHY THIS EXISTS. Several agents port in parallel against ONE `.next`, and
 * `next start` reads the build manifest into memory once. When another agent runs
 * `npm run build`, the running server keeps serving HTML that references the
 * PREVIOUS build's Tailwind chunk — a file that no longer exists. The route then
 * returns 200, renders, and loads only the component's own stylesheet, with the
 * entire design system absent.
 *
 * This is CLAUDE.md's stale-server hazard in a variant it does not name: not
 * "old server, new build" but "server started on build N, build N+1 landed
 * underneath it". It cost one full round of measurements that read as component
 * defects — every width utility inert, `max-width: none`, a hero at 1424 px
 * instead of 832 px — and `curl` returned 200 throughout, exactly as CLAUDE.md
 * warns. Reading the log for `Ready in` does not catch it either, because the
 * server WAS ready; the build moved afterwards.
 *
 * So: assert the page is styled before believing any number off it.
 */

/** Throws unless every linked stylesheet loaded and the design system resolved.
 *  Call immediately after `goto`, before any measurement.
 *
 *  POLLS RATHER THAN ASSERTING ONCE. The first version asserted immediately
 *  after `waitForLoadState('load')` and produced a false "stale build" on the
 *  slow-4g condition of picture-cls.cjs, where the 55 KB Tailwind chunk takes
 *  over a second — the guard's own failure mode, in the same shape as the bug it
 *  exists to catch. A guard that cannot tell "not yet" from "never" is worse
 *  than none, because it discredits itself. */
async function assertStyled(page, label = '', timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let r;
  for (;;) {
    r = await snapshot(page);
    if (!describe(r).length) return r;
    if (Date.now() > deadline) break;
    await page.waitForTimeout(150);
  }
  report(r, label);
  throw new Error('unstyled page — refusing to measure');
}

async function snapshot(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    /* `sheet` is null for a stylesheet that 404'd. This is the direct
       observation, not an inference from a colour looking wrong. */
    const dead = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .filter((l) => !l.sheet)
      .map((l) => l.href);
    const root = getComputedStyle(document.documentElement);
    const main = document.querySelector('main');
    return {
      links,
      dead,
      /* The design tokens. Empty means design-tokens.css never arrived. */
      canvas: root.getPropertyValue('--color-canvas').trim(),
      hairline: root.getPropertyValue('--color-hairline').trim(),
      /* A Tailwind sentinel: KitchensinkPage puts `max-w-content` on <main>.
         `none` means the utility layer is missing even if the tokens are not. */
      mainMaxWidth: main ? getComputedStyle(main).maxWidth : null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
}

function describe(r) {
  const problems = [];
  if (r.links.length === 0) problems.push('no stylesheets linked at all');
  if (r.dead.length) problems.push(`stylesheet(s) failed to load: ${r.dead.join(', ')}`);
  if (!r.canvas) problems.push('--color-canvas does not resolve (design-tokens.css missing)');
  if (!r.hairline) problems.push('--color-hairline does not resolve');
  if (!r.mainMaxWidth || r.mainMaxWidth === 'none') {
    problems.push(`main max-width is ${r.mainMaxWidth} — the Tailwind utility layer is missing`);
  }
  if (r.bodyBg === 'rgba(0, 0, 0, 0)') problems.push('body has no background — @layer base did not apply');
  return problems;
}

function report(r, label) {
  console.error(`\n*** STALE BUILD / UNSTYLED PAGE${label ? ' — ' + label : ''} ***`);
  for (const p of describe(r)) console.error(`    ${p}`);
  console.error(`    linked: ${r.links.join(' ') || '(none)'}`);
  console.error('    Fix: npm run build, then restart the server on this port, then re-run.');
  console.error('    Another agent almost certainly rebuilt .next underneath this server.\n');
}

module.exports = { assertStyled };
