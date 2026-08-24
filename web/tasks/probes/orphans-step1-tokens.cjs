/* orphans-step1-tokens.cjs — measure what the VERBATIM stylesheets resolved to.
 * F-061 said the bridge covers the semantic tier and colour reads the constant
 * tier. All three of these stylesheets read constants. This quantifies it.  */
const { chromium } = require('playwright');
const READS = [
  '--COLOR-N10', '--COLOR-N20', '--COLOR-N30', '--COLOR-N80', '--COLOR-B90',
  '--grid-layout-gap', '--grid-layout-columns', '--grid-container-columns',
  '--borderWidth', '--fontSize-label-sm', '--color-text-muted',
  '--fontSize-label-small', '--fontFamily-body', '--size-md', '--fontSize-body-small',
];
(async () => {
  const b = await chromium.launch();
  for (const appearance of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto('http://localhost:3210/primitives/table', { waitUntil: 'load' });
    await p.evaluate((a) => document.documentElement.setAttribute('data-appearance', a), appearance);
    const r = await p.evaluate((READS) => {
      const cs = getComputedStyle(document.documentElement);
      const tokens = {};
      for (const t of READS) tokens[t] = cs.getPropertyValue(t).trim() || '(UNDEFINED)';
      const th = document.querySelector('thead th');
      const td = document.querySelector('tbody td');
      const rowh = document.querySelector('tbody th[scope="row"]');
      const tbl = document.querySelector('table');
      const pick = (el, props) => el ? Object.fromEntries(props.map(x => [x, getComputedStyle(el).getPropertyValue(x)])) : null;
      return {
        tokens,
        table: pick(tbl, ['overflow-x', 'border-collapse', 'border-spacing', 'border-top-width']),
        theadTh: pick(th, ['background-color', 'color', 'border-top-color', 'border-top-width']),
        tbodyTd: pick(td, ['color', 'border-left-color', 'border-left-width', 'border-bottom-width']),
        rowHeader: pick(rowh, ['background-image']),
      };
    }, READS);
    console.log(`\n=== ${appearance.toUpperCase()} ===`);
    for (const [k, v] of Object.entries(r.tokens)) console.log(`  ${k.padEnd(28)} ${v}`);
    for (const part of ['table', 'theadTh', 'tbodyTd', 'rowHeader']) {
      console.log(`  ${part}: ${JSON.stringify(r[part])}`);
    }
    await p.close();
  }
  /* Same question for the other two routes. */
  for (const [route, sels] of Object.entries({
    '/primitives/covercomposition': ['.CoverComposition', '.media-container', '.overlay', '.content-container', '.content-container > div'],
    '/primitives/circlediagram': ['.CircleDiagram', '.CircleDiagram-chart', '.CircleDiagram-center', '.CircleDiagram-subtitle', '.CircleDiagram-legend-item'],
  })) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto('http://localhost:3210' + route, { waitUntil: 'load' });
    await p.waitForTimeout(300);
    const r = await p.evaluate((sels) => sels.map((s) => {
      const el = document.querySelector(s);
      if (!el) return [s, 'NOT FOUND'];
      const cs = getComputedStyle(el);
      const bb = el.getBoundingClientRect();
      return [s, {
        bg: cs.backgroundColor, color: cs.color, pe: cs.pointerEvents,
        display: cs.display, pos: cs.position, gtc: cs.gridTemplateColumns,
        gap: cs.columnGap, ct: cs.containerType,
        box: `${Math.round(bb.width)}x${Math.round(bb.height)}`,
      }];
    }), sels);
    console.log(`\n=== ${route} (light) ===`);
    for (const [s, v] of r) console.log(`  ${s.padEnd(28)} ${JSON.stringify(v)}`);
    await p.close();
  }
  await b.close();
})();
