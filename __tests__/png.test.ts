import zlib from 'node:zlib';

// Plain CommonJS build scripts, not app code — required rather than imported.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encodePng, decodePng, chunk } = require('../scripts/png');

/**
 * The PNG reader exists so App Store screenshots can be resized without adding
 * a native image library. It only has to handle what a phone screenshot is, but
 * it does have to handle that correctly — a silent decoding bug would show up
 * as smeared screenshots on the store listing, which is a bad place to find it.
 *
 * The filter round-trip is the test that matters. Real encoders pick a
 * different filter per row, and a wrong Paeth predictor produces an image that
 * looks almost right.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function gradient(width: number, height: number): Buffer {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = (x * 7) % 256;
      rgba[i + 1] = (y * 13) % 256;
      rgba[i + 2] = (x * y) % 256;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

/**
 * Writes a PNG that uses a different row filter on every row, cycling through
 * all five. This is what a real encoder does and what the reader has to undo.
 */
function encodeWithEveryFilter(width: number, height: number, rgba: Buffer): Buffer {
  const channels = 4;
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));

  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = y % 5;
    raw[y * (stride + 1)] = filter;

    for (let i = 0; i < stride; i += 1) {
      const value = rgba[y * stride + i];
      const left = i >= channels ? rgba[y * stride + i - channels] : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= channels ? rgba[(y - 1) * stride + i - channels] : 0;

      let encoded: number;
      switch (filter) {
        case 1:
          encoded = value - left;
          break;
        case 2:
          encoded = value - up;
          break;
        case 3:
          encoded = value - ((left + up) >> 1);
          break;
        case 4:
          encoded = value - paeth(left, up, upLeft);
          break;
        default:
          encoded = value;
      }
      raw[y * (stride + 1) + 1 + i] = encoded & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('the PNG writer and reader', () => {
  it('round-trips an image unchanged', () => {
    const rgba = gradient(23, 17);
    const decoded = decodePng(encodePng(23, 17, rgba));

    expect(decoded.width).toBe(23);
    expect(decoded.height).toBe(17);
    expect(Buffer.compare(decoded.rgba, rgba)).toBe(0);
  });

  it('undoes every row filter a real encoder uses', () => {
    const rgba = gradient(40, 25);
    const decoded = decodePng(encodeWithEveryFilter(40, 25, rgba));
    expect(Buffer.compare(decoded.rgba, rgba)).toBe(0);
  });

  it('reads a PNG with no alpha channel and fills it in as opaque', () => {
    const width = 9;
    const height = 4;
    const rgb = Buffer.alloc(width * height * 3);
    for (let i = 0; i < rgb.length; i += 1) rgb[i] = (i * 5) % 256;

    const stride = width * 3;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y += 1) {
      rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2; // truecolour, no alpha

    const png = Buffer.concat([
      SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);

    const decoded = decodePng(png);
    expect(decoded.width).toBe(width);
    for (let p = 0; p < width * height; p += 1) {
      expect(decoded.rgba[p * 4]).toBe(rgb[p * 3]);
      expect(decoded.rgba[p * 4 + 3]).toBe(255);
    }
  });

  it('survives a tall thin image, which is the shape of a screenshot', () => {
    const rgba = gradient(3, 200);
    expect(Buffer.compare(decodePng(encodePng(3, 200, rgba)).rgba, rgba)).toBe(0);
  });

  it('refuses a file that is not a PNG, rather than guessing', () => {
    expect(() => decodePng(Buffer.from('this is not an image'))).toThrow(/not a png/i);
  });

  it('says what is wrong with a PNG it cannot read', () => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(4, 0);
    ihdr.writeUInt32BE(4, 4);
    ihdr[8] = 8;
    ihdr[9] = 3; // palette

    const png = Buffer.concat([
      SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(Buffer.alloc(20))),
      chunk('IEND', Buffer.alloc(0)),
    ]);

    expect(() => decodePng(png)).toThrow(/truecolour/i);
  });
});
