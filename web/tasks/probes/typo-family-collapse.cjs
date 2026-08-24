/* typo-family-collapse.cjs — what the four-to-two family collapse actually costs.
 *
 * `primitive-tokens.css` collapses the source's four families onto our two and
 * calls it "the largest visual change in the port". That is an assertion. This
 * probe measures it.
 *
 * It loads the four real source faces from Google Fonts (Fira Sans, Abril
 * Fatface, Noto Serif, Inter) into a blank page and renders the same strings
 * twice: once in the SOURCE stack at the SOURCE sizes/weights/line-heights/
 * tracking, once in OURS. It reports, per display step:
 *
 *   · rendered advance width of a fixed string (how much horizontal room the
 *     voice takes — the actual difference between a fat didone and a grotesque)
 *   · cap height and x-height as a fraction of em, measured from the glyph box
 *     via canvas TextMetrics — this is where "magazine voice" lives, not in the
 *     size number
 *   · line box height, which is what `line-height: 0.95` vs `1.1` decides
 *   · characters per line at a fixed 608 px measure, which is the readability
 *     number an editor cares about
 *
 * Requires network. Prints a table; no snapshot, no exit-code contract — it is
 * an instrument, not a gate.
 */
const { chromium } = require('playwright');

/* The source's own declarations, verbatim from
 * ClientApp/scss/tokens/typography/{typography.constant,typography.semantic}.scss */
const SOURCE = {
  display: {
    family: "'Abril Fatface', georgia, serif",
    weight: 400,
    lineHeight: 0.95,
    tracking: '-0.01em',
    /* desktop constants */
    sizes: { '1': 64, '2': 56, '3': 48 },
  },
  heading: {
    family: "'Fira Sans', system-ui, sans-serif",
    weight: 600,
    lineHeight: 1.1,
    tracking: 'normal',
    sizes: { '1': 56, '2': 40, '3': 32, '4': 24, '5': 20, '6': 18 },
  },
  body: {
    family: "'Noto Serif', georgia, serif",
    weight: 400,
    lineHeight: 1.5,
    tracking: 'normal',
    sizes: { lg: 28, md: 20, sm: 16 },
  },
};

/* Ours, as `primitive-tokens.css` maps them onto design-tokens.css. */
const OURS = {
  display: {
    family: "Inter, system-ui, sans-serif",
    weight: 400,
    lineHeight: null, /* per-step, below */
    tracking: '-0.03em',
    sizes: { '1': 72, '2': 36, '3': 26 },
    lineHeights: { '1': 1.1, '2': 1.1, '3': 1.1 },
  },
  heading: {
    family: "Inter, system-ui, sans-serif",
    weight: 600,
    lineHeight: 1.25,
    tracking: '-0.0125em',
    sizes: { '1': 36, '2': 26, '3': 22, '4': 18, '5': 16, '6': 11 },
  },
  body: {
    family: "Inter, system-ui, sans-serif",
    weight: 400,
    lineHeight: 1.5,
    tracking: '0',
    sizes: { lg: 16, md: 16, sm: 14 },
  },
};

const SPECIMEN = 'Handgloves';
const PARAGRAPH =
  'A component library ports cleanly when its mechanisms survive, not when its pixels do. ' +
  'The Razor primitive set is built on two mechanisms, and only one of them survives.';
const MEASURE = 608; /* the kitchensink Prose column, measured */

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Fira+Sans:wght@400;600&family=Noto+Serif:wght@400;700&family=Inter:wght@400;500;600&display=block">
<style>
  body { margin: 0; }
  .spec { white-space: nowrap; display: inline-block; }
  .para { width: ${MEASURE}px; }
</style></head><body><div id="stage"></div></body></html>`, { waitUntil: 'load' });

  await page.evaluate(() => document.fonts.ready);
  /* `display=block` blocks paint until the real faces arrive; wait for the ones
     we will actually measure so nothing is measured in a fallback. */
  const loaded = await page.evaluate(async () => {
    const want = [
      '400 64px "Abril Fatface"', '600 40px "Fira Sans"',
      '400 20px "Noto Serif"', '400 72px Inter',
    ];
    const out = {};
    for (const f of want) { try { await document.fonts.load(f, 'Handgloves'); } catch {} out[f] = document.fonts.check(f, 'Handgloves'); }
    return out;
  });
  console.log('faces available:', JSON.stringify(loaded));
  if (Object.values(loaded).some((v) => !v)) {
    console.log('\nWARNING — a face did not load. Numbers below are for a FALLBACK, not the real voice.');
  }

  const rows = await page.evaluate(({ SOURCE, OURS, SPECIMEN, PARAGRAPH, MEASURE }) => {
    const stage = document.getElementById('stage');

    /* Cap height / x-height from the glyph bounding box, not from the font
       tables — this is what the eye actually reads as "size". */
    function metrics(family, weight, size) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${weight} ${size}px ${family}`;
      const H = c.measureText('H');
      const x = c.measureText('x');
      return {
        cap: H.actualBoundingBoxAscent / size,
        xh: x.actualBoundingBoxAscent / size,
        width: c.measureText(SPECIMEN).width,
      };
    }

    function render(family, weight, size, lh, tracking, text, cls) {
      const el = document.createElement('div');
      el.className = cls;
      el.style.fontFamily = family;
      el.style.fontWeight = String(weight);
      el.style.fontSize = size + 'px';
      el.style.lineHeight = String(lh);
      el.style.letterSpacing = tracking;
      el.textContent = text;
      stage.appendChild(el);
      const r = el.getBoundingClientRect();
      const out = { w: r.width, h: r.height };
      el.remove();
      return out;
    }

    /* Characters per line at a fixed measure — lines counted from the height of
       one line box versus the height of the flowed paragraph. */
    function cpl(family, weight, size, lh, tracking) {
      const one = render(family, weight, size, lh, tracking, 'x', 'spec').h;
      const many = render(family, weight, size, lh, tracking, PARAGRAPH, 'para').h;
      const lines = Math.max(1, Math.round(many / one));
      return { lines, cpl: Math.round(PARAGRAPH.length / lines) };
    }

    const out = [];
    for (const role of ['display', 'heading', 'body']) {
      const s = SOURCE[role], o = OURS[role];
      for (const step of Object.keys(s.sizes)) {
        const sSize = s.sizes[step], oSize = o.sizes[step];
        const sLh = s.lineHeight ?? s.lineHeights[step];
        const oLh = o.lineHeight ?? o.lineHeights[step];
        const sm = metrics(s.family, s.weight, sSize);
        const om = metrics(o.family, o.weight, oSize);
        const sr = render(s.family, s.weight, sSize, sLh, s.tracking, SPECIMEN, 'spec');
        const or_ = render(o.family, o.weight, oSize, oLh, o.tracking, SPECIMEN, 'spec');
        const sc = cpl(s.family, s.weight, sSize, sLh, s.tracking);
        const oc = cpl(o.family, o.weight, oSize, oLh, o.tracking);
        out.push({
          role, step,
          sSize, oSize,
          sFam: s.family.split(',')[0].replace(/'/g, ''),
          oFam: o.family.split(',')[0],
          sLh, oLh,
          sCap: sm.cap, oCap: om.cap,
          sXh: sm.xh, oXh: om.xh,
          /* Optical size: cap height in PIXELS is what a reader compares. */
          sCapPx: sm.cap * sSize, oCapPx: om.cap * oSize,
          sW: sr.w, oW: or_.w,
          sH: sr.h, oH: or_.h,
          sCpl: sc.cpl, oCpl: oc.cpl,
          sLines: sc.lines, oLines: oc.lines,
        });
      }
    }
    return out;
  }, { SOURCE, OURS, SPECIMEN, PARAGRAPH, MEASURE });

  const f = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : String(n));
  const pct = (a, b) => (b === 0 ? '—' : ((a / b - 1) * 100).toFixed(0) + '%');

  console.log(`\nspecimen "${SPECIMEN}", measure ${MEASURE}px\n`);
  console.log(
    ['role/step', 'src face', 'px', 'lh', 'capPx', '"H..s" w', 'lines',
     '| our face', 'px', 'lh', 'capPx', '"H..s" w', 'lines', '| Δsize', 'Δcap', 'Δwidth'].join('\t'),
  );
  for (const r of rows) {
    console.log([
      `${r.role}-${r.step}`, r.sFam, r.sSize, f(r.sLh), f(r.sCapPx, 1), f(r.sW, 1), r.sLines,
      '|', r.oFam, r.oSize, f(r.oLh), f(r.oCapPx, 1), f(r.oW, 1), r.oLines,
      '|', pct(r.oSize, r.sSize), pct(r.oCapPx, r.sCapPx), pct(r.oW, r.sW),
    ].join('\t'));
  }

  console.log('\ncap-height ratio (cap / em) — the shape number, size-independent:');
  const seen = new Set();
  for (const r of rows) {
    const k = r.role;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  ${k.padEnd(8)} ${r.sFam.padEnd(14)} cap ${f(r.sCap)}  x-h ${f(r.sXh)}   →   ${r.oFam.padEnd(6)} cap ${f(r.oCap)}  x-h ${f(r.oXh)}`);
  }

  console.log('\nbody measure at the Prose column — characters per line:');
  for (const r of rows.filter((x) => x.role === 'body')) {
    console.log(`  body-${r.step}: source ${r.sSize}px Noto Serif → ${r.sCpl} cpl (${r.sLines} lines)   ours ${r.oSize}px Inter → ${r.oCpl} cpl (${r.oLines} lines)`);
  }

  await browser.close();
})();

/* ── Ink density ───────────────────────────────────────────────────────────
 *
 * The cap-height table above shows the four faces are nearly interchangeable in
 * PROPORTION (cap/em 0.69–0.73). That is the surprising half of the result, and
 * it is also incomplete: it cannot see stroke weight, and "a fat display serif"
 * is a statement about stroke weight, not about proportion.
 *
 * So measure the ink. Rasterise the same specimen at the same CAP HEIGHT in each
 * face, count the non-background pixels, and divide by the glyph bounding box.
 * That number is what a reader perceives as "bombastic" vs "editorial", and it
 * is the one thing the collapse cannot preserve.
 *
 * Run: node tasks/probes/typo-family-collapse.cjs --ink
 */
if (process.argv.includes('--ink')) {
  (async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 400 } });
    await page.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Fira+Sans:wght@400;600&family=Noto+Serif:wght@400;700&family=Inter:wght@400;500;600&display=block">
</head><body></body></html>`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const FACES = [
      ['display  source', "'Abril Fatface', serif", 400],
      ['display  ours  ', 'Inter, sans-serif', 400],
      ['heading  source', "'Fira Sans', sans-serif", 600],
      ['heading  ours  ', 'Inter, sans-serif', 600],
      ['body     source', "'Noto Serif', serif", 400],
      ['body     ours  ', 'Inter, sans-serif', 400],
    ];

    const out = await page.evaluate(async (FACES) => {
      const SPEC = 'Handgloves';
      const TARGET_CAP = 100; /* normalise on cap height, not on em */
      const rows = [];
      for (const [label, family, weight] of FACES) {
        await document.fonts.load(`${weight} 100px ${family.split(',')[0]}`, SPEC);
        const probe = document.createElement('canvas').getContext('2d');
        probe.font = `${weight} 100px ${family}`;
        const cap = probe.measureText('H').actualBoundingBoxAscent;
        const size = (TARGET_CAP / cap) * 100;

        const c = document.createElement('canvas');
        c.width = 1600; c.height = 400;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#000';
        ctx.font = `${weight} ${size}px ${family}`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(SPEC, 20, 300);
        const m = ctx.measureText(SPEC);
        const box = {
          x: 20 - m.actualBoundingBoxLeft, y: 300 - m.actualBoundingBoxAscent,
          w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
        };
        const d = ctx.getImageData(
          Math.max(0, Math.floor(box.x)), Math.max(0, Math.floor(box.y)),
          Math.ceil(box.w), Math.ceil(box.h),
        ).data;
        let ink = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { ink += (255 - d[i]) / 255; n++; }
        rows.push({
          label, size: Math.round(size * 10) / 10,
          advance: Math.round(m.width),
          boxW: Math.round(box.w), boxH: Math.round(box.h),
          ink: ink / n,
        });
      }
      return rows;
    }, FACES);

    console.log(`\n=== ink density at a normalised 100px cap height, specimen "Handgloves" ===\n`);
    console.log(['role / side', 'px for cap=100', 'advance', 'glyph box', 'ink coverage'].join('\t'));
    for (const r of out) {
      console.log([r.label, r.size, r.advance, `${r.boxW}×${r.boxH}`, (r.ink * 100).toFixed(1) + '%'].join('\t'));
    }
    for (let i = 0; i < out.length; i += 2) {
      const a = out[i], b = out[i + 1];
      console.log(
        `\n  ${a.label.trim().split(/\s+/)[0]}: ink ${(a.ink * 100).toFixed(1)}% → ${(b.ink * 100).toFixed(1)}% ` +
        `(${((b.ink / a.ink - 1) * 100).toFixed(0)}%), advance at equal cap ${a.advance} → ${b.advance}px ` +
        `(${((b.advance / a.advance - 1) * 100).toFixed(0)}%)`,
      );
    }
    await browser.close();
  })();
}
