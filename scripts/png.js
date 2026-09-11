/**
 * A minimal PNG reader and writer, built on Node's zlib and nothing else.
 *
 * The project already generated its icons this way rather than pulling in
 * `sharp`, which is a large native dependency that has historically been awkward
 * to install on Windows. The reader here exists for the same reason: resizing
 * App Store screenshots is a job that runs on one machine, a handful of times,
 * and is not worth a native toolchain.
 *
 * Deliberately narrow. It reads 8-bit, non-interlaced, truecolour PNGs with or
 * without alpha — which is what a phone screenshot is — and says so plainly
 * when handed anything else, rather than guessing and producing a mess.
 */

const zlib = require('zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// --- CRC ---------------------------------------------------------------------

function crc32(buf) {
  let c;
  const table =
    crc32.table ||
    (crc32.table = (() => {
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

// --- Writing -----------------------------------------------------------------

/** rgba: a Buffer of w*h*4 bytes. */
function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    const row = Buffer.isBuffer(rgba) ? rgba : Buffer.from(rgba);
    row.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Reading -----------------------------------------------------------------

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Returns { width, height, rgba } with rgba as w*h*4 bytes. */
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('Not a PNG file.');
  }

  let offset = 8;
  let header = null;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length; // length + type + data + crc

    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!header) throw new Error('PNG has no header chunk.');
  if (header.bitDepth !== 8) {
    throw new Error(`Only 8-bit PNGs are supported (this one is ${header.bitDepth}-bit).`);
  }
  if (header.interlace !== 0) {
    throw new Error('Interlaced PNGs are not supported.');
  }
  if (header.colorType !== 2 && header.colorType !== 6) {
    throw new Error(
      `Only truecolour PNGs are supported (colour type 2 or 6, this one is ${header.colorType}). ` +
        'Re-save it as a standard PNG.',
    );
  }

  const { width, height } = header;
  const channels = header.colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));

  // Undo the per-scanline filters. Each row is prefixed with its filter type
  // and is predicted from the row above and the pixel to the left.
  const out = Buffer.alloc(height * stride);
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = Buffer.alloc(stride);

    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      const value = line[i];

      switch (filter) {
        case 0:
          row[i] = value;
          break;
        case 1:
          row[i] = (value + left) & 0xff;
          break;
        case 2:
          row[i] = (value + up) & 0xff;
          break;
        case 3:
          row[i] = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          row[i] = (value + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unknown PNG row filter ${filter}.`);
      }
    }

    row.copy(out, y * stride);
    previous = row;
  }

  // Normalise to RGBA so callers only deal with one layout.
  if (channels === 4) return { width, height, rgba: out };

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < out.length; i += 3, j += 4) {
    rgba[j] = out[i];
    rgba[j + 1] = out[i + 1];
    rgba[j + 2] = out[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}

module.exports = { encodePng, decodePng, crc32, chunk };
