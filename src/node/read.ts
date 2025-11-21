/**
 * Node.js read functionality
 */

import * as fs from 'fs/promises';
import { CharPack, MemoryCharPack, RawImageData, Rectangle } from '../core/types';
import { deserialize } from '../core/format';
import { applyPatches } from '../core/diff';
import { toPNG, toJPEG, toWebP, toBase64 } from './image-processor';

// Re-export internal functions for visualization purposes
export { deserialize } from '../core/format';
export { applyPatches } from '../core/diff';
export { toPNG } from './image-processor';

/**
 * Extract a single variation from CharPack file
 */
export async function extract(input: string, variation: string): Promise<CharPack> {
  const buffer = await fs.readFile(input);
  const charPackData = deserialize(buffer);

  const varMeta = charPackData.variations.find((v) => v.name === variation);
  if (!varMeta) {
    throw new Error(`Variation '${variation}' not found in CharPack`);
  }

  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  const image = await applyPatches(baseImage, varMeta.patches);

  return {
    png: () => toPNG(image),
    jpeg: () => toJPEG(image),
    webp: () => toWebP(image),
    base64: () => toBase64(image),
  };
}

/**
 * Read entire CharPack into memory for efficient multi-variation reading
 */
export async function read(input: string): Promise<MemoryCharPack> {
  let buffer = await fs.readFile(input);
  let charPackData = deserialize(buffer);

  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  const getImage = async (variation: string): Promise<RawImageData> => {
    const varMeta = charPackData.variations.find((v) => v.name === variation);
    if (!varMeta) {
      throw new Error(`Variation '${variation}' not found in CharPack`);
    }
    return applyPatches(baseImage, varMeta.patches);
  };

  return {
    png: async (variation: string) => toPNG(await getImage(variation)),
    jpeg: async (variation: string) => toJPEG(await getImage(variation)),
    webp: async (variation: string) => toWebP(await getImage(variation)),
    base64: async (variation: string) => toBase64(await getImage(variation)),
    dispose: () => {
      // Release references to help GC
      (charPackData as any) = null;
      (buffer as any) = null;
    },
    refresh: async () => {
      // Reload from disk
      buffer = await fs.readFile(input);
      charPackData = deserialize(buffer);
    },
  };
}

/**
 * Create a visualization of compressed regions in a CharPack file
 * Gray areas show parts that are compressed (shared across all variations)
 * Non-gray areas show parts that differ between variations and are stored as patches
 */
export async function visualizeCompression(input: string): Promise<CharPack> {
  const buffer = await fs.readFile(input);
  const charPackData = deserialize(buffer);

  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  // Collect all unique patch rectangles from all variations
  const allRects: Rectangle[] = [];
  for (const variation of charPackData.variations) {
    for (const patch of variation.patches) {
      allRects.push(patch.rect);
    }
  }

  // Create visualization image by drawing gray overlays on base image
  const visualizationImage = createCompressionVisualization(baseImage, allRects);

  return {
    png: () => toPNG(visualizationImage),
    jpeg: () => toJPEG(visualizationImage),
    webp: () => toWebP(visualizationImage),
    base64: () => toBase64(visualizationImage),
  };
}

/**
 * Create a visualization for a specific variation showing its patches
 * Red areas show the patches that differ from the base image
 */
export async function visualizeVariationPatches(input: string, variationName: string): Promise<CharPack> {
  const buffer = await fs.readFile(input);
  const charPackData = deserialize(buffer);

  return visualizeVariationPatchesFromData(charPackData, variationName);
}

/**
 * Create a visualization for a specific variation showing its patches from deserialized data
 * Red areas show the patches that differ from the base image
 * This version avoids re-reading the file if data is already available
 */
export async function visualizeVariationPatchesFromData(charPackData: any, variationName: string): Promise<CharPack> {
  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  const variation = charPackData.variations.find((v: any) => v.name === variationName);
  if (!variation) {
    throw new Error(`Variation '${variationName}' not found in CharPack`);
  }

  // Compose the full variation image first to use as visualization background
  const variationImage = applyPatches(baseImage, variation.patches);

  // Create visualization highlighting this variation's patches on top of the variation image
  const visualizationImage = createVariationPatchesVisualization(await variationImage, variation.patches);

  return {
    png: () => toPNG(visualizationImage),
    jpeg: () => toJPEG(visualizationImage),
    webp: () => toWebP(visualizationImage),
    base64: () => toBase64(visualizationImage),
  };
}

/**
 * Create a visualization image highlighting the patches for a specific variation
 */
function createVariationPatchesVisualization(baseImage: RawImageData, patches: any[]): RawImageData {
  const { width, height, channels } = baseImage;

  // Clone the base image data
  const resultData = Buffer.from(baseImage.data);

  // Apply red overlay to patch regions
  const overlayOpacity = 0.7; // 70% red overlay
  const redValues = [200, 50, 50]; // RGB values for red

  for (const patch of patches) {
    const { x, y, width: patchWidth, height: patchHeight } = patch.rect;

    for (let dy = 0; dy < patchHeight; dy++) {
      for (let dx = 0; dx < patchWidth; dx++) {
        const px = x + dx;
        const py = y + dy;

        // Skip pixels outside image bounds
        if (px >= width || py >= height) continue;

        const dataIndex = (py * width + px) * channels;

        // Blend original color with red overlay
        for (let c = 0; c < Math.min(3, channels); c++) { // Only RGB channels
          const original = resultData[dataIndex + c];
          resultData[dataIndex + c] = Math.round(original * (1 - overlayOpacity) + redValues[c] * overlayOpacity);
        }
      }
    }
  }

  return {
    width,
    height,
    channels,
    data: resultData,
  };
}

/**
 * Create a visualization image with blue overlays on compressed regions
 * Blue areas represent parts that are compressed (shared across variations)
 * Non-blue areas represent parts that differ between variations
 */
function createCompressionVisualization(baseImage: RawImageData, compressedRects: Rectangle[]): RawImageData {
  const { width, height, channels } = baseImage;

  // Clone the base image data
  const resultData = Buffer.from(baseImage.data);

  // Create a mask to track which pixels have been modified (differing regions)
  const modifiedMask = Buffer.allocUnsafe(width * height);
  modifiedMask.fill(0);

  // Mark all pixels in compressed rectangles as modified
  for (const rect of compressedRects) {
    const { x, y, width: rectWidth, height: rectHeight } = rect;

    for (let dy = 0; dy < rectHeight; dy++) {
      for (let dx = 0; dx < rectWidth; dx++) {
        const px = x + dx;
        const py = y + dy;

        // Skip pixels outside image bounds
        if (px >= width || py >= height) continue;

        const pixelIndex = py * width + px;
        modifiedMask[pixelIndex] = 1; // Mark as modified
      }
    }
  }

  // Apply blue overlay to pixels that are NOT modified (compressed regions)
  const overlayOpacity = 0.6; // 60% blue overlay

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      const dataIndex = pixelIndex * channels;

      // Only apply overlay to unmodified pixels (compressed regions)
      if (modifiedMask[pixelIndex] === 0) {
        // Blend original color with blue overlay
        const blueValues = [0, 100, 200]; // RGB values for blue
        for (let c = 0; c < Math.min(3, channels); c++) { // Only RGB channels
          const original = resultData[dataIndex + c];
          resultData[dataIndex + c] = Math.round(original * (1 - overlayOpacity) + blueValues[c] * overlayOpacity);
        }
      }
      // Pixels in compressed rectangles (modifiedMask[pixelIndex] === 1) keep original colors
    }
  }

  return {
    width,
    height,
    channels,
    data: resultData,
  };
}

