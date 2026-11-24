import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * Generates crisp PNG icons for TileCraft PWA (192x192, 512x512, maskable-512,
 * 180x180 apple-touch-icon, 48x48 favicon) with zero external dependencies.
 */

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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, rx, ry, rw, rh, radius) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  const cx = Math.min(Math.max(x, rx + radius), rx + rw - radius);
  const cy = Math.min(Math.max(y, ry + radius), ry + rh - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function setPixel(buf, width, x, y, r, g, b, a = 255) {
  const idx = (y * width + x) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

function renderTileCraftIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);

  // Fill background (#0F131D)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(buf, size, x, y, 15, 19, 29, 255);
    }
  }

  // Maskable icons require extra safe-zone margin (20% padding)
  const pad = Math.round(size * (maskable ? 0.18 : 0.08));
  const frameSize = size - pad * 2;
  const frameRadius = Math.round(frameSize * 0.22);

  // Outer gold rim + obsidian molded bezel
  const bezelInset = Math.max(2, Math.round(frameSize * 0.035));
  const cavityInset = Math.round(frameSize * 0.12);
  const cavitySize = frameSize - cavityInset * 2;
  const cavityX = pad + cavityInset;
  const cavityY = pad + cavityInset;
  const cavityRadius = Math.round(cavitySize * 0.14);

  const gap = Math.max(2, Math.round(cavitySize * 0.055));
  const tileSize = Math.floor((cavitySize - gap * 3) / 2);
  const tileRadius = Math.round(tileSize * 0.18);

  const tiles = [
    { x: cavityX + gap, y: cavityY + gap, color: [247, 245, 238] }, // Top-left ivory
    { x: cavityX + gap * 2 + tileSize, y: cavityY + gap, color: [245, 158, 11] }, // Top-right gold accent tile
    { x: cavityX + gap, y: cavityY + gap * 2 + tileSize, color: [247, 245, 238] }, // Bottom-left ivory
  ];
  const blankSlot = {
    x: cavityX + gap * 2 + tileSize,
    y: cavityY + gap * 2 + tileSize,
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Gold accent outer frame rim
      if (insideRoundedRect(x, y, pad, pad, frameSize, frameSize, frameRadius)) {
        setPixel(buf, size, x, y, 245, 158, 11, 255);
      }

      // Molded obsidian body
      if (
        insideRoundedRect(
          x,
          y,
          pad + bezelInset,
          pad + bezelInset,
          frameSize - bezelInset * 2,
          frameSize - bezelInset * 2,
          Math.max(4, frameRadius - bezelInset)
        )
      ) {
        setPixel(buf, size, x, y, 31, 35, 43, 255);
      }

      // Recessed inner tray cavity
      if (insideRoundedRect(x, y, cavityX, cavityY, cavitySize, cavitySize, cavityRadius)) {
        setPixel(buf, size, x, y, 14, 16, 22, 255);
      }

      // Subtle dark recessed marker in empty cavity (bottom-right)
      if (
        insideRoundedRect(
          x,
          y,
          blankSlot.x + 2,
          blankSlot.y + 2,
          tileSize - 4,
          tileSize - 4,
          Math.max(2, tileRadius - 2)
        )
      ) {
        setPixel(buf, size, x, y, 20, 24, 34, 255);
      }

      // Three tactile beveled tiles
      for (const t of tiles) {
        if (insideRoundedRect(x, y, t.x, t.y, tileSize, tileSize, tileRadius)) {
          const isTopGloss = y < t.y + tileSize * 0.36;
          const r = Math.min(255, t.color[0] + (isTopGloss ? 10 : 0));
          const g = Math.min(255, t.color[1] + (isTopGloss ? 10 : 0));
          const b = Math.min(255, t.color[2] + (isTopGloss ? 10 : 0));
          setPixel(buf, size, x, y, r, g, b, 255);
        }
      }
    }
  }

  return encodePng(size, size, buf);
}

const outDir = join(process.cwd(), 'public');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'icon-512.png'), renderTileCraftIcon(512, false));
writeFileSync(join(outDir, 'icon-192.png'), renderTileCraftIcon(192, false));
writeFileSync(join(outDir, 'maskable-512.png'), renderTileCraftIcon(512, true));
writeFileSync(join(outDir, 'apple-touch-icon.png'), renderTileCraftIcon(180, false));
writeFileSync(join(outDir, 'favicon.png'), renderTileCraftIcon(48, false));

console.log('Generated TileCraft PWA PNG icons in public/');
