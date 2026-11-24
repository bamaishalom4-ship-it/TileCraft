import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { PALETTE } from '../theme/tokens';

interface TileCraftWordmarkProps {
  /** Optional max width override in pixels. Defaults to responsive 100% width. */
  maxWidth?: number;
}

/**
 * Original 16-bit stepped pixel-block letter bitmaps (height = 30 subpixels).
 * Each filled cell ('#') is rendered with:
 * - Outer 2-unit ink border + hard offset drop shadow (#161820)
 * - Outer 1-unit Arcade Orange rim (#FF8A16)
 * - Thin 1-unit Cream inset outline (#FFF0D0)
 * - Bold Arcade Orange core (#FF8A16 with subtle lower warm shade #E66F0A)
 */
type RectDef = { x: number; y: number; w: number; h: number };

interface GlyphSpec {
  width: number;
  rects: RectDef[];
  cuts?: RectDef[];
}

const GLYPH_HEIGHT = 30;
const LETTER_GAP = 3;

const GLYPHS: Record<string, GlyphSpec> = {
  T: {
    width: 19,
    rects: [
      { x: 0, y: 0, w: 19, h: 6 },
      { x: 6, y: 0, w: 7, h: 30 },
    ],
    cuts: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 17, y: 0, w: 2, h: 2 },
      { x: 6, y: 28, w: 1, h: 2 },
      { x: 12, y: 28, w: 1, h: 2 },
    ],
  },
  I: {
    width: 9,
    rects: [{ x: 1, y: 0, w: 7, h: 30 }],
    cuts: [
      { x: 1, y: 0, w: 1, h: 1 },
      { x: 7, y: 0, w: 1, h: 1 },
      { x: 1, y: 29, w: 1, h: 1 },
      { x: 7, y: 29, w: 1, h: 1 },
    ],
  },
  L: {
    width: 16,
    rects: [
      { x: 0, y: 0, w: 7, h: 30 },
      { x: 0, y: 24, w: 16, h: 6 },
    ],
    cuts: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 6, y: 0, w: 1, h: 1 },
      { x: 0, y: 28, w: 2, h: 2 },
      { x: 14, y: 28, w: 2, h: 2 },
    ],
  },
  E: {
    width: 17,
    rects: [
      { x: 0, y: 0, w: 7, h: 30 },
      { x: 0, y: 0, w: 17, h: 6 },
      { x: 0, y: 12, w: 15, h: 6 },
      { x: 0, y: 24, w: 17, h: 6 },
    ],
    cuts: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 0, y: 28, w: 2, h: 2 },
      { x: 15, y: 0, w: 2, h: 1 },
      { x: 15, y: 29, w: 2, h: 1 },
    ],
  },
  C: {
    width: 18,
    rects: [
      { x: 0, y: 2, w: 7, h: 26 },
      { x: 2, y: 0, w: 16, h: 6 },
      { x: 2, y: 24, w: 16, h: 6 },
      { x: 12, y: 0, w: 6, h: 8 },
      { x: 12, y: 22, w: 6, h: 8 },
    ],
    cuts: [
      { x: 0, y: 2, w: 1, h: 1 },
      { x: 0, y: 27, w: 1, h: 1 },
      { x: 16, y: 0, w: 2, h: 2 },
      { x: 16, y: 28, w: 2, h: 2 },
    ],
  },
  R: {
    width: 18,
    rects: [
      { x: 0, y: 0, w: 7, h: 30 },
      { x: 0, y: 0, w: 16, h: 6 },
      { x: 11, y: 2, w: 7, h: 14 },
      { x: 0, y: 12, w: 16, h: 6 },
      { x: 9, y: 16, w: 7, h: 6 },
      { x: 10, y: 20, w: 7, h: 6 },
      { x: 11, y: 24, w: 7, h: 6 },
    ],
    cuts: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 16, y: 2, w: 2, h: 2 },
      { x: 16, y: 14, w: 2, h: 2 },
    ],
  },
  A: {
    width: 18,
    rects: [
      { x: 4, y: 0, w: 10, h: 6 },
      { x: 2, y: 2, w: 14, h: 5 },
      { x: 0, y: 5, w: 7, h: 25 },
      { x: 11, y: 5, w: 7, h: 25 },
      { x: 0, y: 15, w: 18, h: 6 },
    ],
    cuts: [
      { x: 4, y: 0, w: 1, h: 1 },
      { x: 13, y: 0, w: 1, h: 1 },
    ],
  },
  F: {
    width: 16,
    rects: [
      { x: 0, y: 0, w: 7, h: 30 },
      { x: 0, y: 0, w: 16, h: 6 },
      { x: 0, y: 12, w: 14, h: 6 },
    ],
    cuts: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 14, y: 0, w: 2, h: 1 },
    ],
  },
};

const WORD = 'TILECRAFT';

interface RunRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function buildWordmarkRuns(): {
  width: number;
  height: number;
  rects: RunRect[];
} {
  const padLeft = 4;
  const padTop = 4;
  const padRight = 7;
  const padBottom = 8;

  let contentWidth = 0;
  for (let i = 0; i < WORD.length; i++) {
    contentWidth += GLYPHS[WORD[i]].width;
    if (i < WORD.length - 1) contentWidth += LETTER_GAP;
  }

  const W = padLeft + contentWidth + padRight;
  const H = padTop + GLYPH_HEIGHT + padBottom;

  // Rasterize foreground glyph mask
  const fg: Uint8Array = new Uint8Array(W * H);
  let cursorX = padLeft;

  for (let i = 0; i < WORD.length; i++) {
    const glyph = GLYPHS[WORD[i]];
    for (const r of glyph.rects) {
      for (let yy = r.y; yy < r.y + r.h; yy++) {
        for (let xx = r.x; xx < r.x + r.w; xx++) {
          const gx = cursorX + xx;
          const gy = padTop + yy;
          if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
            fg[gy * W + gx] = 1;
          }
        }
      }
    }
    if (glyph.cuts) {
      for (const c of glyph.cuts) {
        for (let yy = c.y; yy < c.y + c.h; yy++) {
          for (let xx = c.x; xx < c.x + c.w; xx++) {
            const gx = cursorX + xx;
            const gy = padTop + yy;
            if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
              fg[gy * W + gx] = 0;
            }
          }
        }
      }
    }
    cursorX += glyph.width + LETTER_GAP;
  }

  // Classify every cell:
  // 0 = empty, 1 = ink outline/shadow, 2 = orange outer/core, 3 = cream inset, 4 = deep orange lower shade
  const colorGrid: Uint8Array = new Uint8Array(W * H);

  // Pass 1: Hard offset shadow (+2 right, +4 down) & chunky 2px ink border
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!fg[y * W + x]) continue;

      // Chunky 2px stepped border around glyph
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue; // stepped corner
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            colorGrid[ny * W + nx] = 1;
          }
        }
      }

      // Hard offset drop shadow below & slightly right (arcade marquee weight)
      for (let dy = 1; dy <= 4; dy++) {
        for (let dx = 0; dx <= 2; dx++) {
          if (dx === 2 && dy === 4) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            colorGrid[ny * W + nx] = 1;
          }
        }
      }
    }
  }

  // Compute Chebyshev distance to nearest outside cell for every foreground pixel
  const distToOutside = (x: number, y: number): number => {
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || !fg[ny * W + nx]) {
            return r;
          }
        }
      }
    }
    return 4;
  };

  // Pass 2: Orange rim (dist=1), thin Cream inset outline (dist=2), Orange core (dist>=3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!fg[y * W + x]) continue;
      const d = distToOutside(x, y);
      if (d === 2) {
        colorGrid[y * W + x] = 3; // Thin cream inset outline
      } else if (d >= 3 && y >= padTop + GLYPH_HEIGHT - 8) {
        colorGrid[y * W + x] = 4; // Warm lower orange bevel shade
      } else {
        colorGrid[y * W + x] = 2; // Arcade orange fill & outer rim
      }
    }
  }

  const paletteMap: Record<number, string> = {
    1: PALETTE.ink,
    2: PALETTE.arcadeOrange,
    3: PALETTE.cream,
    4: '#E66E08',
  };

  // Compress adjacent horizontal pixels of same color into crisp SVG rects
  const rects: RunRect[] = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const code = colorGrid[y * W + x];
      if (code === 0) {
        x++;
        continue;
      }
      let runEnd = x + 1;
      while (runEnd < W && colorGrid[y * W + runEnd] === code) {
        runEnd++;
      }
      rects.push({
        x,
        y,
        w: runEnd - x,
        h: 1,
        fill: paletteMap[code],
      });
      x = runEnd;
    }
  }

  return { width: W, height: H, rects };
}

/**
 * Original oversized 16-bit arcade wordmark for TILECRAFT.
 * Stepped pixel lettering with Arcade Orange fill, thin Cream inset outline,
 * and hard Ink offset shadow.
 */
export const TileCraftWordmark: React.FC<TileCraftWordmarkProps> = ({
  maxWidth = 390,
}) => {
  const { width, height, rects } = useMemo(() => buildWordmarkRuns(), []);

  return (
    <View
      testID="tilecraft-wordmark"
      accessibilityRole="header"
      accessibilityLabel="TileCraft"
      style={[styles.wrap, { maxWidth }]}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="TILECRAFT"
        shapeRendering="crispEdges"
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <title>TILECRAFT</title>
        {rects.map((r, idx) => (
          <rect
            key={idx}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.fill}
          />
        ))}
      </svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'center',
  },
});
