/**
 * Browser read functionality
 */

import { CharPack, MemoryCharPack, RawImageData } from '../core/types';
import { deserialize } from '../core/format';
import { applyPatches } from '../core/diff';
import { toPNG, toJPEG, toWebP, toBase64 } from './image-processor';

/**
 * Extract a single variation from CharPack buffer
 */
export function extract(input: Buffer, variation: string): CharPack {
  const charPackData = deserialize(input);

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

  const image = applyPatches(baseImage, varMeta.patches);

  return {
    png: () => toPNG(image),
    jpeg: () => toJPEG(image),
    webp: () => toWebP(image),
    base64: () => toBase64(image),
  };
}

/**
 * Read entire CharPack buffer into memory for efficient multi-variation reading
 */
export async function read(input: Buffer): Promise<MemoryCharPack> {
  let charPackData = deserialize(input);

  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  const getImage = (variation: string): RawImageData => {
    const varMeta = charPackData.variations.find((v) => v.name === variation);
    if (!varMeta) {
      throw new Error(`Variation '${variation}' not found in CharPack`);
    }
    return applyPatches(baseImage, varMeta.patches);
  };

  return {
    png: async (variation: string) => toPNG(getImage(variation)),
    jpeg: async (variation: string) => toJPEG(getImage(variation)),
    webp: async (variation: string) => toWebP(getImage(variation)),
    base64: async (variation: string) => toBase64(getImage(variation)),
    dispose: () => {
      // Release references to help GC
      (charPackData as any) = null;
    },
    refresh: () => {
      // No-op in browser environment (cannot reload from disk)
    },
  };
}

