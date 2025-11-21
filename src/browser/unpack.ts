/**
 * Browser unpack functionality
 */

import { deserialize } from '../core/format';
import { applyPatches } from './diff';
import { toPNG } from './image-processor';
import { RawImageData } from '../core/types';

/**
 * Unpack CharPack buffer to all variations
 */
export async function unpack(
  input: Buffer,
  callback: (images: Record<string, Buffer>) => void
): Promise<void>;

/**
 * Unpack CharPack buffer to specific variations
 */
export async function unpack(
  input: Buffer,
  variations: string[],
  callback: (images: Record<string, Buffer>) => void
): Promise<void>;

/**
 * Implementation
 */
export async function unpack(
  input: Buffer,
  variationsOrCallback: string[] | ((images: Record<string, Buffer>) => void),
  callback?: (images: Record<string, Buffer>) => void
): Promise<void> {
  const charPackData = deserialize(input);

  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  const result: Record<string, Buffer> = {};

  // Case 1: Unpack all variations
  if (typeof variationsOrCallback === 'function') {
    for (const varMeta of charPackData.variations) {
      const image = await applyPatches(baseImage, varMeta.patches);
      const pngBuffer = await toPNG(image);
      result[varMeta.name] = pngBuffer;
    }
    variationsOrCallback(result);
    return;
  }

  // Case 2: Unpack specific variations
  if (Array.isArray(variationsOrCallback) && callback) {
    for (const varName of variationsOrCallback) {
      const varMeta = charPackData.variations.find((v) => v.name === varName);
      if (!varMeta) {
        throw new Error(`Variation '${varName}' not found in CharPack`);
      }

      const image = await applyPatches(baseImage, varMeta.patches);
      const pngBuffer = await toPNG(image);
      result[varName] = pngBuffer;
    }
    callback(result);
    return;
  }

  throw new Error('Invalid unpack arguments');
}

