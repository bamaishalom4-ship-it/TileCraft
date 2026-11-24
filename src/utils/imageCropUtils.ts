import type { GridSize } from '../types/puzzle';

export interface SquareCropInput {
  /** Natural pixel width of the picked source image. */
  imageWidth: number;
  /** Natural pixel height of the picked source image. */
  imageHeight: number;
  /** Side length (in logical UI pixels) of the square crop frame. */
  viewportSize: number;
  /** User zoom multiplier (>= 1.0). 1.0 fits the shorter edge exactly to viewportSize. */
  zoom: number;
  /** User horizontal pan offset in UI pixels (positive = image dragged right). */
  offsetX: number;
  /** User vertical pan offset in UI pixels (positive = image dragged down). */
  offsetY: number;
}

export interface PixelCropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface ClampedOffsets {
  offsetX: number;
  offsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
  renderedWidth: number;
  renderedHeight: number;
}

/**
 * Computes rendered image dimensions inside a square crop viewport at a given zoom
 * and clamps user pan offsets so the square frame never exposes empty background gaps.
 */
export function clampCropOffsets(input: SquareCropInput): ClampedOffsets {
  const safeZoom = Math.max(1, Math.min(4, input.zoom));
  const minDim = Math.min(input.imageWidth, input.imageHeight);
  const baseScale = input.viewportSize / minDim;
  const totalScale = baseScale * safeZoom;

  const renderedWidth = input.imageWidth * totalScale;
  const renderedHeight = input.imageHeight * totalScale;

  const maxOffsetX = Math.max(0, (renderedWidth - input.viewportSize) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - input.viewportSize) / 2);

  const offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, input.offsetX));
  const offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, input.offsetY));

  return {
    offsetX,
    offsetY,
    maxOffsetX,
    maxOffsetY,
    renderedWidth,
    renderedHeight,
  };
}

/**
 * Translates interactive UI pan/zoom state into an exact pixel-accurate 1:1 square
 * crop rectangle for `expo-image-manipulator`.
 *
 * Guarantees:
 * - `width === height` (strict 1:1 aspect ratio)
 * - `0 <= originX <= imageWidth - width`
 * - `0 <= originY <= imageHeight - height`
 */
export function computeSquareCropRegion(input: SquareCropInput): PixelCropRect {
  if (input.imageWidth <= 0 || input.imageHeight <= 0 || input.viewportSize <= 0) {
    throw new Error('Image dimensions and viewportSize must be positive numbers.');
  }

  const clamped = clampCropOffsets(input);
  const scaleToSource = input.imageWidth / clamped.renderedWidth;

  // Center of the rendered image sits at (viewportSize/2 + offsetX, viewportSize/2 + offsetY).
  // Therefore, the viewport's top-left (0, 0) lies at:
  const leftInRendered = clamped.renderedWidth / 2 - input.viewportSize / 2 - clamped.offsetX;
  const topInRendered = clamped.renderedHeight / 2 - input.viewportSize / 2 - clamped.offsetY;

  const rawSide = Math.round(input.viewportSize * scaleToSource);
  const maxSide = Math.min(input.imageWidth, input.imageHeight);
  const side = Math.max(1, Math.min(maxSide, rawSide));

  const rawOriginX = Math.round(leftInRendered * scaleToSource);
  const rawOriginY = Math.round(topInRendered * scaleToSource);

  const originX = Math.max(0, Math.min(input.imageWidth - side, rawOriginX));
  const originY = Math.max(0, Math.min(input.imageHeight - side, rawOriginY));

  return {
    originX,
    originY,
    width: side,
    height: side,
  };
}

/**
 * Computes a 1–3 star rating and coin payout when a player solves a puzzle.
 * Used on the Win Screen (and persisted to the backend ledger in Phase 4).
 */
export function evaluateWinPerformance(
  gridSize: GridSize,
  moves: number,
  elapsedSeconds: number
): { stars: 1 | 2 | 3; coinsEarned: number } {
  const parMoves = gridSize === 3 ? 35 : gridSize === 4 ? 110 : 240;
  const parSeconds = gridSize === 3 ? 60 : gridSize === 4 ? 180 : 360;

  let stars: 1 | 2 | 3 = 1;
  if (moves <= parMoves && elapsedSeconds <= parSeconds) {
    stars = 3;
  } else if (moves <= parMoves * 1.75 || elapsedSeconds <= parSeconds * 1.75) {
    stars = 2;
  }

  const baseCoins = gridSize === 3 ? 15 : gridSize === 4 ? 30 : 60;
  const starBonus = stars === 3 ? 20 : stars === 2 ? 10 : 0;

  return {
    stars,
    coinsEarned: baseCoins + starBonus,
  };
}
