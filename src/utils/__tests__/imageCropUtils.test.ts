import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCropOffsets,
  computeSquareCropRegion,
  evaluateWinPerformance,
} from '../imageCropUtils';

describe('1:1 Square Image Crop Math', () => {
  it('centers a landscape 1600x1000 image into a 1000x1000 square at 1x zoom', () => {
    const rect = computeSquareCropRegion({
      imageWidth: 1600,
      imageHeight: 1000,
      viewportSize: 300,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });

    assert.equal(rect.width, 1000);
    assert.equal(rect.height, 1000);
    assert.equal(rect.originX, 300);
    assert.equal(rect.originY, 0);
  });

  it('centers a portrait 900x1600 image into a 900x900 square at 1x zoom', () => {
    const rect = computeSquareCropRegion({
      imageWidth: 900,
      imageHeight: 1600,
      viewportSize: 300,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });

    assert.equal(rect.width, 900);
    assert.equal(rect.height, 900);
    assert.equal(rect.originX, 0);
    assert.equal(rect.originY, 350);
  });

  it('halves the cropped square side length at 2x zoom while staying strictly in bounds', () => {
    const rect = computeSquareCropRegion({
      imageWidth: 1000,
      imageHeight: 1000,
      viewportSize: 300,
      zoom: 2,
      offsetX: 0,
      offsetY: 0,
    });

    assert.equal(rect.width, 500);
    assert.equal(rect.height, 500);
    assert.equal(rect.originX, 250);
    assert.equal(rect.originY, 250);
  });

  it('clamps extreme user drag offsets so crop coordinates never go out of image bounds', () => {
    const clamped = clampCropOffsets({
      imageWidth: 1600,
      imageHeight: 1000,
      viewportSize: 300,
      zoom: 1.5,
      offsetX: 9999,
      offsetY: -9999,
    });

    assert.equal(clamped.offsetX, clamped.maxOffsetX);
    assert.equal(clamped.offsetY, -clamped.maxOffsetY);

    const rect = computeSquareCropRegion({
      imageWidth: 1600,
      imageHeight: 1000,
      viewportSize: 300,
      zoom: 1.5,
      offsetX: 9999,
      offsetY: -9999,
    });

    assert.equal(rect.width, rect.height);
    assert.ok(rect.originX >= 0 && rect.originX + rect.width <= 1600);
    assert.ok(rect.originY >= 0 && rect.originY + rect.height <= 1000);
  });
});

describe('Win Performance & Coin Rewards', () => {
  it('awards 3 stars and max coin bonus for efficient solves', () => {
    const result = evaluateWinPerformance(4, 75, 90);
    assert.equal(result.stars, 3);
    assert.equal(result.coinsEarned, 50);
  });

  it('scales coin payouts higher for 5x5 master grids than 3x3 boards', () => {
    const win3 = evaluateWinPerformance(3, 20, 30);
    const win5 = evaluateWinPerformance(5, 180, 240);
    assert.ok(win5.coinsEarned > win3.coinsEarned);
  });
});
