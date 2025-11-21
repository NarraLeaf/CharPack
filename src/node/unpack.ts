/**
 * Node.js unpack functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { deserialize } from '../core/format';
import { applyPatches } from '../core/diff';
import { toPNG } from './image-processor';
import { RawImageData } from '../core/types';

/**
 * Unpack CharPack file to directory (all variations)
 */
export async function unpack(input: string, output: string): Promise<Record<string, string>>;

/**
 * Unpack single variation to file
 */
export async function unpack(
  input: string,
  output: string,
  variation: string
): Promise<Record<string, string>>;

/**
 * Unpack multiple variations to files
 */
export async function unpack(
  input: string,
  output: Record<string, string>
): Promise<Record<string, string>>;

/**
 * Implementation
 */
export async function unpack(
  input: string,
  output: string | Record<string, string>,
  variation?: string
): Promise<Record<string, string>> {
  // Read and deserialize CharPack file
  const buffer = await fs.readFile(input);
  const charPackData = deserialize(buffer);

  const baseImage: RawImageData = {
    width: charPackData.width,
    height: charPackData.height,
    channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
    data: charPackData.baseImage,
  };

  // Case 1: Unpack all to directory
  if (typeof output === 'string' && !variation) {
    await fs.mkdir(output, { recursive: true });

    const result: Record<string, string> = {};
    for (const varMeta of charPackData.variations) {
      const image = applyPatches(baseImage, varMeta.patches);
      const pngBuffer = await toPNG(image);
      const outputPath = path.join(output, `${varMeta.name}.png`);
      await fs.writeFile(outputPath, pngBuffer);
      result[varMeta.name] = outputPath;
    }
    return result;
  }

  // Case 2: Unpack single variation to file
  if (typeof output === 'string' && variation) {
    const varMeta = charPackData.variations.find((v) => v.name === variation);
    if (!varMeta) {
      throw new Error(`Variation '${variation}' not found in CharPack`);
    }

    const image = applyPatches(baseImage, varMeta.patches);
    const pngBuffer = await toPNG(image);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, pngBuffer);
    return { [variation]: output };
  }

  // Case 3: Unpack multiple variations to files
  if (typeof output === 'object') {
    const result: Record<string, string> = {};
    for (const [varName, outputPath] of Object.entries(output)) {
      const varMeta = charPackData.variations.find((v) => v.name === varName);
      if (!varMeta) {
        throw new Error(`Variation '${varName}' not found in CharPack`);
      }

      const image = applyPatches(baseImage, varMeta.patches);
      const pngBuffer = await toPNG(image);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, pngBuffer);
      result[varName] = outputPath;
    }
    return result;
  }

  throw new Error('Invalid unpack arguments');
}

