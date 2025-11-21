/**
 * Image diffing algorithm
 * Finds differences between images at pixel level
 */

import { RawImageData, DiffPatch, Rectangle } from './types';
import sharp from 'sharp';

/**
 * Calculate differences between base image and target image
 * Returns list of patches that represent the differences
 */
export async function calculateDiff(
  baseImage: RawImageData,
  targetImage: RawImageData,
  blockSize: number = 32,
  diffThreshold: number = 0,
  colorDistanceThreshold: number = 0,
  diffToleranceRatio: number = 0
): Promise<DiffPatch[]> {
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

      if (
        isBlockDifferent(
          baseImage,
          targetImage,
          x,
          y,
          blockWidth,
          blockHeight,
          diffThreshold,
          colorDistanceThreshold,
          diffToleranceRatio,
        )
      ) {
        diffBlocks.push({ x, y, width: blockWidth, height: blockHeight });
      }
    }
  }

  // Merge adjacent blocks to reduce patch count
  const mergedRects = mergeRectangles(diffBlocks);

  // Extract pixel data & convert to PNG for each patch
  const patches: DiffPatch[] = [];

  for (const rect of mergedRects) {
    const rawBuffer = extractRegion(targetImage, rect);

    // Convert to PNG via sharp (RGBA)
    const pngBuf = await sharp(rawBuffer, {
      raw: {
        width: rect.width,
        height: rect.height,
        channels: targetImage.channels as 1 | 2 | 3 | 4,
      },
    })
      .png()
      .toBuffer();

    patches.push({ rect, data: pngBuf });
  }

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
  height: number,
  threshold: number,
  colorDistThreshold: number,
  toleranceRatio: number
): boolean {
  const channels = base.channels;

  let diffCount = 0;
  const maxDiffAllowed = Math.floor(width * height * toleranceRatio);

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const px = x + dx;
      const py = y + dy;
      const idx = (py * base.width + px) * channels;

      for (let c = 0; c < channels; c++) {
        const diff = Math.abs(base.data[idx + c] - target.data[idx + c]);
        if (colorDistThreshold > 0) {
          // Compute once per pixel (for channel 0)
          if (c === 0) {
            const dr = base.data[idx] - target.data[idx];
            const dg = base.data[idx + 1] - target.data[idx + 1];
            const db = base.data[idx + 2] - target.data[idx + 2];
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist > colorDistThreshold) {
              diffCount++;
              if (toleranceRatio === 0 || diffCount > maxDiffAllowed) return true;
            }
          }
        } else if (diff > threshold) {
          diffCount++;
          if (toleranceRatio === 0 || diffCount > maxDiffAllowed) return true;
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

  // Working copy we can mutate
  const working: Rectangle[] = [...rects];

  // Helper to determine whether two rectangles should be merged.
  // Conditions:
  // 1. True area overlap  → always merge.
  // 2. Share an edge (adjacent) and the overlapped edge length  ≥ 50 % of the
  //    smaller rectangle side.  Prevents long skinny unions caused by tiny
  //    corner contacts or minimal edge contacts.
  const intersectsOrAdjacent = (a: Rectangle, b: Rectangle): boolean => {
    const aRight = a.x + a.width;
    const bRight = b.x + b.width;
    const aBottom = a.y + a.height;
    const bBottom = b.y + b.height;

    // Determine overlap on each axis
    const xOverlap = a.x < bRight && b.x < aRight; // strict >0 overlap
    const yOverlap = a.y < bBottom && b.y < aBottom;

    // Case 1: true overlap area
    if (xOverlap && yOverlap) return true;

    const overlapThreshold = 0.5; // 50 %

    // Case 2: share vertical edge (touch in Y, overlap in X)
    if (xOverlap && (aBottom === b.y || bBottom === a.y)) {
      const overlapLen = Math.min(aRight, bRight) - Math.max(a.x, b.x);
      const minWidth = Math.min(a.width, b.width);
      return overlapLen >= minWidth * overlapThreshold;
    }

    // Case 3: share horizontal edge (touch in X, overlap in Y)
    if (yOverlap && (aRight === b.x || bRight === a.x)) {
      const overlapLen = Math.min(aBottom, bBottom) - Math.max(a.y, b.y);
      const minHeight = Math.min(a.height, b.height);
      return overlapLen >= minHeight * overlapThreshold;
    }

    // Otherwise, separated or only diagonal adjacency -> do not merge
    return false;
  };

  // Iteratively merge until no more merges are possible
  let didMerge = true;
  while (didMerge) {
    didMerge = false;

    outer: for (let i = 0; i < working.length; i++) {
      for (let j = i + 1; j < working.length; j++) {
        if (intersectsOrAdjacent(working[i], working[j])) {
          // Prevent over-merging that would create huge patches. Allow merge only if
          // the resulting union area is not excessively bigger than the sum of the
          // two individual rectangles (<= 1.25×).
          const areaA = working[i].width * working[i].height;
          const areaB = working[j].width * working[j].height;

          const unionWidth =
            Math.max(working[i].x + working[i].width, working[j].x + working[j].width) -
            Math.min(working[i].x, working[j].x);
          const unionHeight =
            Math.max(working[i].y + working[i].height, working[j].y + working[j].height) -
            Math.min(working[i].y, working[j].y);
          const unionArea = unionWidth * unionHeight;

          // If union area significantly exceeds combined area, skip merging
          if (unionArea > (areaA + areaB) * 1.25) {
            continue;
          }

          // Union of the two rectangles
          const union: Rectangle = {
            x: Math.min(working[i].x, working[j].x),
            y: Math.min(working[i].y, working[j].y),
            width:
              Math.max(working[i].x + working[i].width, working[j].x + working[j].width) -
              Math.min(working[i].x, working[j].x),
            height:
              Math.max(working[i].y + working[i].height, working[j].y + working[j].height) -
              Math.min(working[i].y, working[j].y),
          };

          // Replace rectangles i & j with their union
          working.splice(j, 1);
          working[i] = union;
          didMerge = true;
          break outer; // Restart scanning due to modified array
        }
      }
    }
  }

  return working;
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
export async function applyPatches(
  baseImage: RawImageData,
  patches: DiffPatch[]
): Promise<RawImageData> {
  // Clone base image data
  const resultData = Buffer.from(baseImage.data);

  for (const patch of patches) {
    const { x, y, width, height } = patch.rect;

    // Decode PNG patch to raw buffer
    const patchImage = await sharp(patch.data).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const channels = patchImage.info.channels as number;

    if (channels !== baseImage.channels) {
      throw new Error('Channel mismatch between base image and patch image');
    }

    let patchOffset = 0;
    for (let dy = 0; dy < height; dy++) {
      const targetOffset = ((y + dy) * baseImage.width + x) * channels;
      patchImage.data.copy(resultData, targetOffset, patchOffset, patchOffset + width * channels);
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

