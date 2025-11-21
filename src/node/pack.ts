/**
 * Node.js pack functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { PackConfig, CharPackData, VariationMetadata } from '../core/types';
import { calculateDiff } from '../core/diff';
import { serialize } from '../core/format';
import { loadImage } from './image-processor';

/**
 * Pack images into a CharPack file
 */
export async function charpack(options: {
  input: string | string[] | Record<string, string>;
  output: string;
  config?: PackConfig;
}): Promise<void> {
  const { input, output, config = {} } = options;

  // Resolve input to name-path mapping
  const imageMap = await resolveInput(input, config);

  if (Object.keys(imageMap).length === 0) {
    throw new Error('No images found to pack');
  }

  // Load all images
  const images: Array<{ name: string; data: any }> = [];
  for (const [name, filePath] of Object.entries(imageMap)) {
    try {
      const imageData = await loadImage(filePath);
      images.push({ name, data: imageData });
    } catch (error) {
      throw new Error(`Failed to load image ${filePath}: ${error}`);
    }
  }

  // Validate all images have same dimensions
  const firstImage = images[0].data;
  for (const img of images.slice(1)) {
    if (
      img.data.width !== firstImage.width ||
      img.data.height !== firstImage.height
    ) {
      throw new Error(
        'All images must have the same dimensions. ' +
        `Expected ${firstImage.width}x${firstImage.height}, ` +
        `but got ${img.data.width}x${img.data.height} for ${img.name}`
      );
    }
  }

  // Use first image as base
  const baseImage = firstImage;

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

  // Create CharPack data
  const charPackData: CharPackData = {
    version: 1,
    width: baseImage.width,
    height: baseImage.height,
    format: 'raw',
    baseImage: baseImage.data,
    variations,
  };

  // Serialize and save
  const buffer = serialize(charPackData);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, buffer);
}

/**
 * Resolve input to name-path mapping
 */
async function resolveInput(
  input: string | string[] | Record<string, string>,
  config: PackConfig
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
 * Convert file paths to name-path mapping
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
      if (config.withExtension) {
        name = basename;
      } else {
        name = path.parse(basename).name;
      }
    }

    result[name] = file;
  }

  return result;
}

