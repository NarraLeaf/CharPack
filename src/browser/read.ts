/**
 * Browser read functionality
 */

import { CharPack, MemoryCharPack, RawImageData } from '../core/types';
import { deserialize } from '../core/format';
import { applyPatches } from './diff';
import { toPNG, toJPEG, toWebP, toBase64 } from './image-processor';

/**
 * Extract a single variation from CharPack buffer
 */
export async function extract(input: Buffer, variation: string): Promise<CharPack> {
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

  const image = await applyPatches(baseImage, varMeta.patches);

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

  const getImage = async (variation: string): Promise<RawImageData> => {
    const varMeta = charPackData.variations.find((v) => v.name === variation);
    if (!varMeta) {
      throw new Error(`Variation '${variation}' not found in CharPack`);
    }
    return await applyPatches(baseImage, varMeta.patches);
  };

  return {
    png: async (variation: string) => toPNG(await getImage(variation)),
    jpeg: async (variation: string) => toJPEG(await getImage(variation)),
    webp: async (variation: string) => toWebP(await getImage(variation)),
    base64: async (variation: string) => toBase64(await getImage(variation)),
    dispose: () => {
      // Release references to help GC
      (charPackData as any) = null;
    },
    refresh: () => {
      // No-op in browser environment (cannot reload from disk)
    },
  };
}

