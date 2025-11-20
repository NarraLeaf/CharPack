/**
 * Browser pack functionality
 */

import { CharPackData, VariationMetadata } from '../core/types';
import { calculateDiff } from '../core/diff';
import { serialize } from '../core/format';
import { loadImageFromBuffer } from './image-processor';

/**
 * Pack images into a CharPack buffer
 */
export async function charpack(
  input: Record<string, Buffer>,
  callback: (buffer: Buffer) => void
): Promise<void> {
  const names = Object.keys(input);
  
  if (names.length === 0) {
    throw new Error('No images provided to pack');
  }

  // Load all images
  const images: Array<{ name: string; data: any }> = [];
  for (const name of names) {
    try {
      const imageData = await loadImageFromBuffer(input[name]);
      images.push({ name, data: imageData });
    } catch (error) {
      throw new Error(`Failed to load image ${name}: ${error}`);
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
  const variations: VariationMetadata[] = images.map((img) => ({
    name: img.name,
    patches: calculateDiff(baseImage, img.data),
  }));

  // Create CharPack data
  const charPackData: CharPackData = {
    version: 1,
    width: baseImage.width,
    height: baseImage.height,
    format: 'raw',
    baseImage: baseImage.data,
    variations,
  };

  // Serialize and return via callback
  const buffer = serialize(charPackData);
  callback(buffer);
}

