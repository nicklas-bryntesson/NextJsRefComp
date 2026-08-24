/* orphans-guard.cjs — refuse to measure an unstyled page.
 *
 * CLAUDE.md documents the stale-server trap (a `pkill` that does not match, an
 * old server answering 200 from a `.next` later builds overwrote). This project
 * now has SEVERAL agents building in the same `web/` directory, which produces
 * the same end state from a different cause: my server was started from a good
 * build, a concurrent `npm run build` rewrote `.next`, and the HTML my server had
 * already committed to referenced a CSS chunk that no longer existed.
 *
 * Measured symptom: `/primitives/table` served
 *   <link rel="stylesheet" href="/_next/static/chunks/0vp50q60ektp1.css">  -> 404
 *   <link rel="stylesheet" href="/_next/static/chunks/0z3cb8tq7silg.css">  -> 200
 * so ONE of two stylesheets was missing. Every computed colour came back
 * `rgb(0, 0, 0)`, every font-size `16px`, and the probe reported "21:1" contrast
 * ratios and a perfectly-sized 200px chart. A green-looking run on a page with no
 * design at all — exactly the failure that "produced three wrong reports in this
 * project". A `curl` 200 on the PAGE proves nothing; the assets have to be
 * checked too. F-093.
 *
 * Every probe in this set calls this first. It throws rather than warns, because
 * a warning in a long log is how this gets missed.
 */
module.exports = async function guard(page, { sentinelSelector, sentinelProperty, sentinelMustNotBe }) {
  const bad = await page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const results = [];
    for (const href of links) {
      const r = await fetch(href, { method: 'GET' });
      if (!r.ok) results.push(`${href} -> ${r.status}`);
    }
    return { links, results, sheets: document.styleSheets.length };
  });
  if (bad.results.length) {
    throw new Error(
      `UNSTYLED PAGE: ${bad.results.length} of ${bad.links.length} stylesheet(s) failed:\n  ` +
        bad.results.join('\n  ') +
        `\nRebuild and restart the server before measuring (see orphans-guard.cjs).`,
    );
  }
  if (sentinelSelector) {
    const v = await page.evaluate(
      ({ s, p }) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el).getPropertyValue(p) : '(no element)';
      },
      { s: sentinelSelector, p: sentinelProperty },
    );
    if (v === sentinelMustNotBe || v === '(no element)') {
      throw new Error(
        `SENTINEL FAILED: ${sentinelSelector} { ${sentinelProperty} } = "${v}" — the ` +
          `component stylesheet did not apply even though every <link> resolved.`,
      );
    }
  }
  return bad;
};
