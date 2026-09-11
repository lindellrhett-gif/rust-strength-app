/**
 * Turns screenshots taken on your phone into the size App Store Connect wants.
 *
 *   npm run screenshots
 *
 * Drop PNGs into store/screenshots/raw/ and the resized copies appear in
 * store/screenshots/appstore/, numbered in filename order — so name them 1-add
 * -set.png, 2-workout.png and so on to control the order they appear in the
 * listing.
 *
 * Why this exists: App Store Connect wants 6.9-inch iPhone screenshots, which
 * are 1290 x 2796. An iPhone 16 Pro has a 6.3-inch screen and takes 1206 x 2622
 * shots, and uploading those is simply refused.
 *
 * The two shapes are very nearly the same, so the image is scaled up to fit and
 * centred on the app's own background colour. The bars that leaves are about
 * two pixels wide, on a near-black background, against a near-black app. You
 * will not find them.
 *
 * Scaling up loses a little sharpness. If you ever get hold of a Pro Max, shoot
 * natively at 1290 x 2796 and skip this.
 */

const fs = require('fs');
const path = require('path');

const { decodePng, encodePng } = require('./png');

/** Apple's 6.9-inch portrait size. 1320 x 2868 is also accepted. */
const TARGET_WIDTH = 1290;
const TARGET_HEIGHT = 2796;

/** The app's background, so the padding disappears into the screenshot. */
const BACKGROUND = [0x0b, 0x0d, 0x10];

const ROOT = path.join(__dirname, '..');
const IN_DIR = path.join(ROOT, 'store', 'screenshots', 'raw');
const OUT_DIR = path.join(ROOT, 'store', 'screenshots', 'appstore');

/**
 * Bilinear resample. Nearest-neighbour would be fewer lines, but this is text
 * being scaled by about 7%, and nearest-neighbour makes small type look chewed.
 */
function resize(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y += 1) {
    const sy = Math.min(srcH - 1, Math.max(0, (y + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = sy - y0;

    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.min(srcW - 1, Math.max(0, (x + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = sx - x0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;
      const out = (y * dstW + x) * 4;

      for (let c = 0; c < 4; c += 1) {
        const top = src[i00 + c] * (1 - wx) + src[i10 + c] * wx;
        const bottom = src[i01 + c] * (1 - wx) + src[i11 + c] * wx;
        dst[out + c] = Math.round(top * (1 - wy) + bottom * wy);
      }
    }
  }

  return dst;
}

/** Scale to fit inside the target, then centre on the background. */
function fit(src, srcW, srcH) {
  const scale = Math.min(TARGET_WIDTH / srcW, TARGET_HEIGHT / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const scaled = resize(src, srcW, srcH, w, h);

  const canvas = Buffer.alloc(TARGET_WIDTH * TARGET_HEIGHT * 4);
  for (let i = 0; i < TARGET_WIDTH * TARGET_HEIGHT; i += 1) {
    canvas[i * 4] = BACKGROUND[0];
    canvas[i * 4 + 1] = BACKGROUND[1];
    canvas[i * 4 + 2] = BACKGROUND[2];
    canvas[i * 4 + 3] = 255;
  }

  const offsetX = Math.floor((TARGET_WIDTH - w) / 2);
  const offsetY = Math.floor((TARGET_HEIGHT - h) / 2);
  for (let y = 0; y < h; y += 1) {
    const from = y * w * 4;
    const to = ((y + offsetY) * TARGET_WIDTH + offsetX) * 4;
    scaled.copy(canvas, to, from, from + w * 4);
  }

  return { canvas, w, h, offsetX, offsetY };
}

function main() {
  if (!fs.existsSync(IN_DIR)) {
    fs.mkdirSync(IN_DIR, { recursive: true });
    console.log(`Created ${path.relative(ROOT, IN_DIR)}`);
    console.log('Put your screenshots in there and run this again.');
    return;
  }

  const files = fs
    .readdirSync(IN_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();

  if (files.length === 0) {
    console.log(`No PNGs in ${path.relative(ROOT, IN_DIR)}.`);
    console.log('AirDrop your screenshots to the PC, drop them in there, and run this again.');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const file of files) {
    try {
      const source = decodePng(fs.readFileSync(path.join(IN_DIR, file)));
      const { canvas, w, h } = fit(source.rgba, source.width, source.height);
      const out = path.join(OUT_DIR, file);
      fs.writeFileSync(out, encodePng(TARGET_WIDTH, TARGET_HEIGHT, canvas));

      const padding = TARGET_WIDTH - w;
      console.log(
        `${file}: ${source.width}x${source.height} -> ${TARGET_WIDTH}x${TARGET_HEIGHT}` +
          ` (image ${w}x${h}, ${padding}px of background)`,
      );
      written += 1;
    } catch (error) {
      console.error(`${file}: SKIPPED — ${error.message}`);
    }
  }

  if (written > 0) {
    console.log(`\n${written} ready in ${path.relative(ROOT, OUT_DIR)}.`);
    console.log('Upload those to App Store Connect under the 6.9" iPhone size.');
  }

  if (files.length > 10) {
    console.log('\nNote: App Store Connect takes at most 10 screenshots.');
  }
}

main();
