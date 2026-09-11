/**
 * Generates the app icons with no image dependencies.
 *
 * Node's zlib is enough to write a valid PNG by hand, which avoids adding
 * `sharp` (a large native dep) just to draw a few flat shapes. Re-run with
 * `node scripts/make-icons.js` after changing the mark.
 *
 * Rust Strength's mark: a rust-orange barbell on the app's near-black ground.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- palette ---------------------------------------------------------------
const BG = [0x0b, 0x0d, 0x10]; // app background
const RUST = [0xb7, 0x52, 0x1e]; // oxidised iron
const RUST_LIGHT = [0xd9, 0x6f, 0x32]; // highlight edge
const STEEL = [0xc7, 0xd2, 0xdc]; // knurled bar

// --- tiny PNG writer -------------------------------------------------------
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/** rgba: Uint8Array of size w*h*4 */
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    if (rgba.copy) {
      rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    } else {
      Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- drawing ---------------------------------------------------------------
function canvas(size, bg) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    buf[i * 4] = bg ? bg[0] : 0;
    buf[i * 4 + 1] = bg ? bg[1] : 0;
    buf[i * 4 + 2] = bg ? bg[2] : 0;
    buf[i * 4 + 3] = bg ? 255 : 0;
  }
  return buf;
}

/** Anti-aliased rounded rectangle, coordinates in 0..1 of the canvas. */
function roundRect(buf, size, x0, y0, x1, y1, r, color) {
  const px = (v) => v * size;
  const [ax, ay, bx, by, rr] = [px(x0), px(y0), px(x1), px(y1), px(r)];
  const SS = 3; // supersample for smooth edges

  for (let y = Math.floor(ay - 2); y < Math.ceil(by + 2); y += 1) {
    if (y < 0 || y >= size) continue;
    for (let x = Math.floor(ax - 2); x < Math.ceil(bx + 2); x += 1) {
      if (x < 0 || x >= size) continue;
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px2 = x + (sx + 0.5) / SS;
          const py2 = y + (sy + 0.5) / SS;
          if (px2 < ax || px2 > bx || py2 < ay || py2 > by) continue;
          // Round the corners by distance to the inset rectangle.
          const cx = Math.min(Math.max(px2, ax + rr), bx - rr);
          const cy = Math.min(Math.max(py2, ay + rr), by - rr);
          const dx = px2 - cx;
          const dy = py2 - cy;
          if (dx * dx + dy * dy <= rr * rr || (dx === 0 && dy === 0)) hits += 1;
        }
      }
      if (hits === 0) continue;
      const a = hits / (SS * SS);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        buf[i + c] = Math.round(buf[i + c] * (1 - a) + color[c] * a);
      }
      buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * a));
    }
  }
}

/**
 * The barbell mark, drawn in normalised coordinates so it scales to any size.
 * Plates are stacked outward from the centre, heaviest inboard.
 */
function drawBarbell(buf, size) {
  const midY = 0.5;
  const barH = 0.085;
  // Sized to fill the frame: a thin mark disappears at 60px on a home screen.
  roundRect(buf, size, 0.06, midY - barH / 2, 0.94, midY + barH / 2, barH / 2, STEEL);

  // inner plates (tall), then outer plates (shorter) on each side
  const plates = [
    { x0: 0.15, x1: 0.28, h: 0.62, color: RUST },
    { x0: 0.305, x1: 0.4, h: 0.44, color: RUST_LIGHT },
    { x0: 0.72, x1: 0.85, h: 0.62, color: RUST },
    { x0: 0.6, x1: 0.695, h: 0.44, color: RUST_LIGHT },
  ];
  for (const p of plates) {
    roundRect(buf, size, p.x0, midY - p.h / 2, p.x1, midY + p.h / 2, 0.03, p.color);
  }

  // collars
  roundRect(buf, size, 0.283, midY - 0.13, 0.302, midY + 0.13, 0.009, STEEL);
  roundRect(buf, size, 0.698, midY - 0.13, 0.717, midY + 0.13, 0.009, STEEL);
}

// --- outputs ---------------------------------------------------------------
const assets = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assets, { recursive: true });

function write(name, size, { bg, scale = 1, transparent = false }) {
  const buf = canvas(size, transparent ? null : bg);
  if (scale === 1) {
    drawBarbell(buf, size);
  } else {
    // Draw into a larger virtual space then only the centred portion shows,
    // which is how the Android adaptive icon safe zone is respected.
    const inset = Buffer.alloc(size * size * 4);
    inset.set(buf);
    drawBarbellScaled(inset, size, scale);
    inset.copy(buf);
  }
  fs.writeFileSync(path.join(assets, name), encodePng(size, size, buf));
  console.log('wrote', name, `${size}x${size}`);
}

/** Same mark, shrunk toward the centre by `scale`. */
function drawBarbellScaled(buf, size, scale) {
  const tmp = canvas(size, null);
  drawBarbell(tmp, size);
  const off = ((1 - scale) / 2) * size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.round((x - off) / scale);
      const sy = Math.round((y - off) / scale);
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      const si = (sy * size + sx) * 4;
      const di = (y * size + x) * 4;
      const a = tmp[si + 3] / 255;
      if (a === 0) continue;
      for (let c = 0; c < 3; c += 1) {
        buf[di + c] = Math.round(buf[di + c] * (1 - a) + tmp[si + c] * a);
      }
      buf[di + 3] = 255;
    }
  }
}

// App Store / Play Store icon: full bleed, opaque (Apple rejects alpha).
write('icon.png', 1024, { bg: BG });
// Android adaptive foreground: mark sits inside the 66% safe zone.
write('adaptive-icon.png', 1024, { bg: BG, scale: 0.62 });
// Splash mark: transparent so the configured background shows through.
write('splash-icon.png', 512, { bg: BG, transparent: true });
// Favicon for any web build.
write('favicon.png', 48, { bg: BG });
