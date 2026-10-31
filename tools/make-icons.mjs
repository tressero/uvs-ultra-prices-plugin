/**
 * Generate the extension icons (a dollar sign on the site's blue) without any
 * binary assets checked in or an image library.
 *
 *   node tools/make-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'extension', 'src', 'icons');

const BACKGROUND = [47, 74, 138]; // #2f4a8a
const FOREGROUND = [255, 255, 255];

// 5x7 "$"
const GLYPH = [
  '00100',
  '01111',
  '10100',
  '01110',
  '00101',
  '11110',
  '00100',
];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const glyphW = GLYPH[0].length;
  const glyphH = GLYPH.length;
  const cell = Math.max(1, Math.floor((size * 0.62) / glyphH));
  const offsetX = Math.round((size - glyphW * cell) / 2);
  const offsetY = Math.round((size - glyphH * cell) / 2);

  const set = (x, y, colour, alpha = 255) => {
    const i = (y * size + x) * 4;
    rgba[i] = colour[0];
    rgba[i + 1] = colour[1];
    rgba[i + 2] = colour[2];
    rgba[i + 3] = alpha;
  };

  // Rounded square background with 1px antialiasing on the corners.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const distance = Math.hypot(dx, dy);
      if (distance <= radius) set(x, y, BACKGROUND);
      else if (distance <= radius + 1) {
        const alpha = Math.round(255 * (1 - (distance - radius)));
        set(x, y, BACKGROUND, Math.max(0, Math.min(255, alpha)));
      }
    }
  }

  // Glyph.
  for (let gy = 0; gy < glyphH; gy++) {
    for (let gx = 0; gx < glyphW; gx++) {
      if (GLYPH[gy][gx] !== '1') continue;
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const px = offsetX + gx * cell + x;
          const py = offsetY + gy * cell + y;
          if (px >= 0 && py >= 0 && px < size && py < size) set(px, py, FOREGROUND);
        }
      }
    }
  }

  return png(size, size, rgba);
}

await mkdir(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = join(OUT, `icon-${size}.png`);
  await writeFile(file, draw(size));
  console.log(`icon-${size}.png`);
}
