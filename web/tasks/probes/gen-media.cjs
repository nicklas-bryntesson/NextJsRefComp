/* gen-media.cjs — generate the LOCAL media set the Picture kitchensink renders.
 *
 * WHY LOCAL FILES. The source resolves every URL through Umbraco's
 * `GetCropUrl(cropAlias, width, preferFocalPoint, format)`, which needs a CMS.
 * The route has to work offline, so the port's `cropUrl` is a pluggable seam and
 * the kitchensink passes a resolver pointing at these static files instead.
 *
 * WHY REAL FILES AT REAL SIZES, rather than one placeholder repeated. The CLS
 * measurement is only meaningful if each srcset candidate has the intrinsic
 * dimensions it claims — the whole layout-shift question is "when does the
 * browser learn the aspect ratio". Same-file candidates would make the port look
 * better behaved than the source is.
 *
 * Visual coding, so the negotiation is observable rather than merely asserted:
 *   crop alias  -> gradient hue AND aspect ratio (HTML art direction: resize the
 *                  hero and both change)
 *   width step  -> number of white marker boxes along the top edge (resolution
 *                  switching)
 *   media item  -> colour of the bottom-left corner block
 * The machine-checkable version is `img.currentSrc`, which picture-negotiate.cjs
 * reads.
 *
 * Requires ffmpeg, sips (macOS) and cwebp on PATH. Written in Node rather than
 * bash because macOS ships bash 3.2, which has no associative arrays.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../../public/media');

/* `horizontal` is 1:1 on the authority of Teaser.css, which declares
 * `aspect-ratio: 1 / 1` on `.Media.HorizontalSources`. The other five ratios are
 * INVENTED: Umbraco crop definitions live in the CMS, so these aliases are names
 * with no dimensions attached anywhere in the source repo. See findings. */
const CROPS = {
  stacked:    { ratio: [3, 2],  c0: '0x2f6f4e', c1: '0x8ecfb4', widths: [400, 800] },
  horizontal: { ratio: [1, 1],  c0: '0x1f4e79', c1: '0x8fc3e8', widths: [320, 640] },
  mobile:     { ratio: [4, 5],  c0: '0x7a2f5f', c1: '0xe0a2c8', widths: [380, 760] },
  portrait:   { ratio: [3, 4],  c0: '0x8a5a1f', c1: '0xf0cf95', widths: [440, 880] },
  mid:        { ratio: [16, 9], c0: '0x1f6f7a', c1: '0x9fdbe3', widths: [740, 1480] },
  wide:       { ratio: [21, 9], c0: '0x5a2f8a', c1: '0xc3a2f0', widths: [1280, 1512, 1728] },
};

const ITEMS = {
  orchard: { marker: '0xf54e00', aliases: ['mobile', 'portrait', 'mid', 'wide', 'stacked', 'horizontal'] },
  atrium:  { marker: '0x2f6f4e', aliases: ['stacked', 'horizontal'] },
  lattice: { marker: '0x5a2f8a', aliases: ['stacked', 'horizontal'] },
};

let n = 0;
for (const [item, { marker, aliases }] of Object.entries(ITEMS)) {
  const dir = path.join(OUT, item);
  fs.mkdirSync(dir, { recursive: true });
  for (const alias of aliases) {
    const { ratio: [rw, rh], c0, c1, widths } = CROPS[alias];
    widths.forEach((w, idx) => {
      const h = Math.round((w * rh) / rw);
      const bw = Math.max(6, Math.round(w / 14));
      const bh = Math.max(6, Math.round(h / 14));
      const boxes = [];
      for (let i = 0; i <= idx; i++) {
        boxes.push(`drawbox=x=${Math.round(bw / 2) + i * bw * 2}:y=${Math.round(bh / 2)}:w=${bw}:h=${bh}:color=white@0.88:t=fill`);
      }
      boxes.push(`drawbox=x=${Math.round(bw / 2)}:y=${h - bh - Math.round(bh / 2)}:w=${bw * 2}:h=${bh}:color=${marker}@0.95:t=fill`);
      const png = path.join(dir, `.${alias}-${w}.png`);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', `gradients=s=${w}x${h}:c0=${c0}:c1=${c1}:type=radial:n=2:d=0.04`,
        '-frames:v', '1', '-vf', `drawgrid=w=iw/8:h=ih/8:t=1:color=white@0.10,${boxes.join(',')}`, png]);
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '60', png, '--out', path.join(dir, `${alias}-${w}.jpg`)], { stdio: 'ignore' });
      execFileSync('sips', ['-s', 'format', 'avif', '-s', 'formatOptions', '45', png, '--out', path.join(dir, `${alias}-${w}.avif`)], { stdio: 'ignore' });
      execFileSync('cwebp', ['-quiet', '-q', '60', png, '-o', path.join(dir, `${alias}-${w}.webp`)]);
      fs.unlinkSync(png);
      console.log(`  ${item.padEnd(8)} ${alias.padEnd(11)} ${String(w).padStart(5)}x${String(h).padEnd(5)}  avif/webp/jpg`);
      n += 3;
    });
  }
}
console.log(`done: ${n} files in ${OUT}`);
