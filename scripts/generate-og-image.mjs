import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * Generates a branded 1200x630 Open Graph social preview PNG (`public/og-preview.png`)
 * showing TileCraft's dark theme, tactile molded 3x3 sliding puzzle board, and crisp title.
 */

const WIDTH = 1200;
const HEIGHT = 630;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// 5x7 crisp bitmap font for branded wordmark & tile numbers
const FONT_5X7 = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '·': ['00000', '00000', '00100', '00100', '00000', '00000', '00000'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
};

const buf = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x, y, r, g, b, a = 255) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
  const idx = (iy * WIDTH + ix) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

function fillRoundedRect(rx, ry, rw, rh, radius, r, g, b) {
  const x0 = Math.max(0, Math.floor(rx));
  const y0 = Math.max(0, Math.floor(ry));
  const x1 = Math.min(WIDTH - 1, Math.ceil(rx + rw));
  const y1 = Math.min(HEIGHT - 1, Math.ceil(ry + rh));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const cx = Math.min(Math.max(x, rx + radius), rx + rw - radius);
      const cy = Math.min(Math.max(y, ry + radius), ry + rh - radius);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(x, y, r, g, b);
      }
    }
  }
}

function drawText(text, startX, startY, scale, r, g, b, letterGap = 2) {
  let cursorX = Math.round(startX);
  const stepX = Math.round((5 + letterGap) * scale);
  for (const ch of text.toUpperCase()) {
    const glyph = FONT_5X7[ch] || FONT_5X7[' '];
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] === '1') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              setPixel(cursorX + gx * scale + sx, startY + gy * scale + sy, r, g, b);
            }
          }
        }
      }
    }
    cursorX += stepX;
  }
}

// 1. Dark radial-tinted background (#0F131D -> #181E2E)
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const dx = (x - 320) / 700;
    const dy = (y - 315) / 500;
    const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
    const r = Math.min(255, Math.round(15 + glow * 16));
    const g = Math.min(255, Math.round(19 + glow * 20));
    const b = Math.min(255, Math.round(29 + glow * 32));
    setPixel(x, y, r, g, b);
  }
}

// 2. Left side: Tactile Molded 3x3 Sliding Puzzle Tray
const frameX = 86;
const frameY = 95;
const frameSize = 440;

// Gold rim & molded obsidian tray
fillRoundedRect(frameX - 4, frameY - 4, frameSize + 8, frameSize + 8, 42, 245, 158, 11);
fillRoundedRect(frameX, frameY, frameSize, frameSize, 38, 31, 35, 43);
fillRoundedRect(frameX + 24, frameY + 24, frameSize - 48, frameSize - 48, 24, 14, 16, 22);

const cavityX = frameX + 36;
const cavityY = frameY + 36;
const gap = 12;
const tileSize = Math.floor((frameSize - 72 - gap * 2) / 3);
const boardLayout = [1, 2, 3, 4, 5, 6, 7, 8, 0];

for (let i = 0; i < 9; i++) {
  const val = boardLayout[i];
  const row = Math.floor(i / 3);
  const col = i % 3;
  const tx = cavityX + col * (tileSize + gap);
  const ty = cavityY + row * (tileSize + gap);

  if (val === 0) {
    // Recessed empty cavity
    fillRoundedRect(tx + 4, ty + 4, tileSize - 8, tileSize - 8, 14, 22, 27, 38);
    continue;
  }

  const isGoldTile = val === 5 || val === 8;
  const baseR = isGoldTile ? 245 : 247;
  const baseG = isGoldTile ? 158 : 245;
  const baseB = isGoldTile ? 11 : 238;

  // Shadow edge + main face + top specular highlight
  fillRoundedRect(tx, ty + 4, tileSize, tileSize, 18, 12, 14, 20);
  fillRoundedRect(tx, ty, tileSize, tileSize, 18, baseR, baseG, baseB);
  fillRoundedRect(
    tx + 6,
    ty + 5,
    tileSize - 12,
    Math.floor(tileSize * 0.34),
    12,
    Math.min(255, baseR + 12),
    Math.min(255, baseG + 12),
    Math.min(255, baseB + 12)
  );

  // Crisp centered tile number
  const numScale = 6;
  const numW = 5 * numScale;
  const numH = 7 * numScale;
  drawText(
    String(val),
    Math.round(tx + (tileSize - numW) / 2),
    Math.round(ty + (tileSize - numH) / 2),
    numScale,
    24,
    30,
    46
  );
}

// 3. Right side: Branded Wordmark, Pills & Subtitle
const textX = 590;
drawText('TILECRAFT', textX, 175, 9, 248, 250, 252, 1.4);
fillRoundedRect(textX, 260, 180, 6, 3, 245, 158, 11);

drawText('SLIDING PHOTO PUZZLE', textX, 294, 4, 226, 232, 240, 1.2);
drawText('3X3 · 4X4 · 5X5', textX, 346, 4, 245, 158, 11, 1.4);

// Feature pill badges
fillRoundedRect(textX, 412, 262, 48, 14, 24, 30, 46);
drawText('CUSTOM PHOTOS', textX + 20, 426, 3, 226, 232, 240, 1);

fillRoundedRect(textX + 278, 412, 244, 48, 14, 24, 30, 46);
drawText('OFFLINE PLAY', textX + 300, 426, 3, 110, 231, 183, 1);

drawText('BY MADEBYKUBO', textX, 504, 3, 148, 163, 184, 1.2);

const outDir = join(process.cwd(), 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'og-preview.png'), encodePng(WIDTH, HEIGHT, buf));
console.log('Generated branded 1200x630 Open Graph preview at public/og-preview.png');
