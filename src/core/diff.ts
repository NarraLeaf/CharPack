/**
 * Image diffing algorithm
 * Finds differences between images at pixel level
 */

import { RawImageData, DiffPatch, Rectangle } from './types';

/**
 * Calculate differences between base image and target image
 * Returns list of patches that represent the differences
 */
export function calculateDiff(
  baseImage: RawImageData,
  targetImage: RawImageData,
  blockSize: number = 32
): DiffPatch[] {
  if (
    baseImage.width !== targetImage.width ||
    baseImage.height !== targetImage.height ||
    baseImage.channels !== targetImage.channels
  ) {
    throw new Error('Images must have the same dimensions and channels');
  }

  const width = baseImage.width;
  const height = baseImage.height;
  const channels = baseImage.channels;

  // Find all different blocks
  const diffBlocks: Rectangle[] = [];

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const blockWidth = Math.min(blockSize, width - x);
      const blockHeight = Math.min(blockSize, height - y);

      if (isBlockDifferent(baseImage, targetImage, x, y, blockWidth, blockHeight)) {
        diffBlocks.push({ x, y, width: blockWidth, height: blockHeight });
      }
    }
  }

  // Merge adjacent blocks to reduce patch count
  const mergedRects = mergeRectangles(diffBlocks);

  // Extract pixel data for each patch
  const patches: DiffPatch[] = mergedRects.map((rect) => ({
    rect,
    data: extractRegion(targetImage, rect),
  }));

  return patches;
}

/**
 * Check if a block is different between two images
 */
function isBlockDifferent(
  base: RawImageData,
  target: RawImageData,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const channels = base.channels;

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const px = x + dx;
      const py = y + dy;
      const idx = (py * base.width + px) * channels;

      for (let c = 0; c < channels; c++) {
        if (base.data[idx + c] !== target.data[idx + c]) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Merge adjacent rectangles to reduce patch count
 * This is a simple greedy algorithm
 */
function mergeRectangles(rects: Rectangle[]): Rectangle[] {
  if (rects.length === 0) return [];

  // Sort by y, then x
  const sorted = [...rects].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const merged: Rectangle[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Try to merge horizontally (same row)
    if (
      current.y === next.y &&
      current.height === next.height &&
      current.x + current.width === next.x
    ) {
      current = {
        x: current.x,
        y: current.y,
        width: current.width + next.width,
        height: current.height,
      };
    }
    // Try to merge vertically (same column)
    else if (
      current.x === next.x &&
      current.width === next.width &&
      current.y + current.height === next.y
    ) {
      current = {
        x: current.x,
        y: current.y,
        width: current.width,
        height: current.height + next.height,
      };
    }
    // Cannot merge, push current and start new
    else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Extract a rectangular region from an image
 */
export function extractRegion(image: RawImageData, rect: Rectangle): Buffer {
  const { x, y, width, height } = rect;
  const channels = image.channels;
  const buffer = Buffer.allocUnsafe(width * height * channels);

  let bufferOffset = 0;
  for (let dy = 0; dy < height; dy++) {
    const sourceOffset = ((y + dy) * image.width + x) * channels;
    image.data.copy(buffer, bufferOffset, sourceOffset, sourceOffset + width * channels);
    bufferOffset += width * channels;
  }

  return buffer;
}

/**
 * Apply patches to a base image to reconstruct the target image
 */
export function applyPatches(
  baseImage: RawImageData,
  patches: DiffPatch[]
): RawImageData {
  // Clone base image data
  const resultData = Buffer.from(baseImage.data);

  // Apply each patch
  for (const patch of patches) {
    const { x, y, width, height } = patch.rect;
    const channels = baseImage.channels;

    let patchOffset = 0;
    for (let dy = 0; dy < height; dy++) {
      const targetOffset = ((y + dy) * baseImage.width + x) * channels;
      patch.data.copy(resultData, targetOffset, patchOffset, patchOffset + width * channels);
      patchOffset += width * channels;
    }
  }

  return {
    width: baseImage.width,
    height: baseImage.height,
    channels: baseImage.channels,
    data: resultData,
  };
}

