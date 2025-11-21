/**
 * Node.js read functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { CharPackImage, CharPack, RawImageData, Rectangle, PackConfig, CharPackData, VariationMetadata } from '../core/types';
import { deserialize, parseHeaderWithIndex, VariationIndex, serialize, addVariationsToFile, removeVariationsFromFile } from '../core/format';
import { applyPatches, calculateDiff } from '../core/diff';
import { decompress } from '../core/compress';
import { toPNG, toJPEG, toWebP, toBase64, loadImage } from './image-processor';

// Re-export internal functions for visualization purposes
export { deserialize, parseHeaderWithIndex } from '../core/format';
export { applyPatches } from '../core/diff';
export { toPNG } from './image-processor';

/**
 * Extract and parse a single variation's patch data from a CharPack file using random access.
 * Uses the index table to read only the required variation block.
 */
async function extractVariationBlock(
  fileHandle: fs.FileHandle,
  variation: VariationIndex
): Promise<{ name: string; patches: any[] }> {
  // Read the variation data block
  const blockBuffer = Buffer.allocUnsafe(variation.size);
  await fileHandle.read(blockBuffer, 0, variation.size, variation.offset);

  let offset = 0;

  // Parse patch count
  const patchCount = blockBuffer.readUInt32LE(offset);
  offset += 4;

  const patches: any[] = [];
  for (let i = 0; i < patchCount; i++) {
    const x = blockBuffer.readUInt32LE(offset);
    offset += 4;
    const y = blockBuffer.readUInt32LE(offset);
    offset += 4;
    const patchWidth = blockBuffer.readUInt32LE(offset);
    offset += 4;
    const patchHeight = blockBuffer.readUInt32LE(offset);
    offset += 4;
    const dataSize = blockBuffer.readUInt32LE(offset);
    offset += 4;

    // Decompress patch data
    const compData = blockBuffer.subarray(offset, offset + dataSize);
    offset += dataSize;
    const data = decompress(compData);

    patches.push({
      rect: { x, y, width: patchWidth, height: patchHeight },
      data: Buffer.from(data),
    });
  }

  return { name: variation.name, patches };
}

/**
 * Helper function to resolve input images to name-path mapping
 */
async function resolveInputForAdd(
  input: string | string[] | Record<string, string>,
  config: PackConfig = {}
): Promise<Record<string, string>> {
  if (typeof input === 'string') {
    // Glob pattern
    const files = await glob(input, { nodir: true });
    return filesToMap(files, config);
  } else if (Array.isArray(input)) {
    // Array of paths
    return filesToMap(input, config);
  } else {
    // Already a mapping
    return input;
  }
}

/**
 * Helper function to convert file paths to name-path mapping
 */
function filesToMap(
  files: string[],
  config: PackConfig
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const file of files) {
    let name: string;

    if (config.variationName) {
      name = config.variationName(file);
    } else {
      const basename = path.basename(file);
      if (config.withExtension === false) {
        name = path.parse(basename).name;
      } else {
        name = basename;
      }
    }

    result[name] = file;
  }

  return result;
}

/**
 * Helper function to repack CharPack data with current images
 */
async function repackCharPack(
  images: Array<{ name: string; data: RawImageData }>,
  config: PackConfig = {}
): Promise<CharPackData> {
  if (images.length === 0) {
    throw new Error('Cannot repack CharPack with no images');
  }

  // Use first image as base (this may change the base image)
  const baseImage = images[0].data;

  // Calculate diffs for all variations
  const variations: VariationMetadata[] = [];
  for (const img of images) {
    const patches = await calculateDiff(
      baseImage,
      img.data,
      config.blockSize ?? 32,
      config.diffThreshold ?? 0,
      config.colorDistanceThreshold ?? 0,
      config.diffToleranceRatio ?? 0,
      img.name // imageName for debugging
    );
    variations.push({ name: img.name, patches });
  }

  // Create new CharPack data
  return {
    version: 1,
    width: baseImage.width,
    height: baseImage.height,
    format: 'raw',
    baseImage: baseImage.data,
    variations,
  };
}

/**
 * Extract a single variation from CharPack file using random access
 * Reads only the header and the requested variation block for efficiency
 */
export async function extract(input: string, variation: string): Promise<CharPackImage> {
  // Open file for random access
  const fileHandle = await fs.open(input, 'r');

  try {
    // Read header and index table (much smaller than full file)
    const headerBuffer = await fileHandle.readFile();
    const { width, height, channels, baseImage, variations: index } =
      parseHeaderWithIndex(headerBuffer);

    // Find the requested variation in index
    const varEntry = index.find((v) => v.name === variation);
    if (!varEntry) {
      throw new Error(`Variation '${variation}' not found in CharPack`);
    }

    // Extract only the requested variation's patch data
    const varMeta = await extractVariationBlock(fileHandle, varEntry);

    const baseImageData: RawImageData = {
      width,
      height,
      channels,
      data: baseImage,
    };

    const image = await applyPatches(baseImageData, varMeta.patches);

    return {
      png: () => toPNG(image),
      jpeg: () => toJPEG(image),
      webp: () => toWebP(image),
      base64: () => toBase64(image),
    };
  } finally {
    await fileHandle.close();
  }
}

/**
 * Read entire CharPack into memory for efficient multi-variation reading and modification
 */
export async function read(input: string): Promise<CharPack> {
  let buffer = await fs.readFile(input);
  let charPackData = deserialize(buffer);
  let filePath = input;

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

  const writeBackToDisk = async (newData: CharPackData) => {
    const newBuffer = serialize(newData);
    await fs.writeFile(filePath, newBuffer);
    // Update in-memory data
    charPackData = newData;
    buffer = Buffer.from(newBuffer);
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
      buffer = await fs.readFile(filePath);
      charPackData = deserialize(buffer);
    },
    add: async (input: string | string[] | Record<string, string>, packConfig?: PackConfig) => {
      // Resolve input to name-path mapping
      const imageMap = await resolveInputForAdd(input);

      // Load new images
      const newVariations: VariationMetadata[] = [];
      for (const [name, filePath] of Object.entries(imageMap)) {
        // Check if variation already exists
        if (charPackData.variations.some(v => v.name === name)) {
          throw new Error(`Variation '${name}' already exists in CharPack`);
        }

        try {
          const imageData = await loadImage(filePath);
          // Validate dimensions match
          if (imageData.width !== charPackData.width || imageData.height !== charPackData.height) {
            throw new Error(
              `Image dimensions ${imageData.width}x${imageData.height} don't match CharPack dimensions ${charPackData.width}x${charPackData.height}`
            );
          }

          // Calculate patches for the new variation against the current base image
          const patches = await calculateDiff(
            baseImage,
            imageData,
            packConfig?.blockSize ?? 32,
            packConfig?.diffThreshold ?? 0,
            packConfig?.colorDistanceThreshold ?? 0,
            packConfig?.diffToleranceRatio ?? 0,
            name // imageName for debugging
          );

          newVariations.push({ name, patches });
        } catch (error) {
          throw new Error(`Failed to load image ${filePath}: ${error}`);
        }
      }

      if (newVariations.length === 0) {
        return; // Nothing to add
      }

      // Use incremental modification instead of full repack
      const channels = baseImage.channels;
      await addVariationsToFile(filePath, newVariations, charPackData.baseImage, charPackData.width, charPackData.height, channels);

      // Update in-memory data by re-reading from disk
      buffer = await fs.readFile(filePath);
      charPackData = deserialize(buffer);
    },
    remove: async (variation: string) => {
      // Check if variation exists
      const variationExists = charPackData.variations.some(v => v.name === variation);
      if (!variationExists) {
        throw new Error(`Variation '${variation}' not found in CharPack`);
      }

      // Check if this would remove all variations
      if (charPackData.variations.length <= 1) {
        throw new Error('Cannot remove the last variation from CharPack');
      }

      // Use incremental modification instead of full repack
      await removeVariationsFromFile(filePath, [variation]);

      // Update in-memory data by re-reading from disk
      buffer = await fs.readFile(filePath);
      charPackData = deserialize(buffer);
    },
    list: async () => {
      return charPackData.variations.map(v => v.name);
    },
  };
}

/**
 * Create a visualization of compressed regions in a CharPack file
 * Gray areas show parts that are compressed (shared across all variations)
 * Non-gray areas show parts that differ between variations and are stored as patches
 */
export async function visualizeCompression(input: string): Promise<CharPackImage> {
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
export async function visualizeVariationPatches(input: string, variationName: string): Promise<CharPackImage> {
  const buffer = await fs.readFile(input);
  const charPackData = deserialize(buffer);

  return visualizeVariationPatchesFromData(charPackData, variationName);
}

/**
 * Create a visualization for a specific variation showing its patches from deserialized data
 * Red areas show the patches that differ from the base image
 * This version avoids re-reading the file if data is already available
 */
export async function visualizeVariationPatchesFromData(charPackData: any, variationName: string): Promise<CharPackImage> {
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

