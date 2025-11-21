/**
 * CharPack file format serialization and deserialization
 * 
 * Format structure:
 * - Magic number: "CHPK" (4 bytes)
 * - Version: uint32 (4 bytes)
 * - Width: uint32 (4 bytes)
 * - Height: uint32 (4 bytes)
 * - Channels: uint8 (1 byte)
 * - Base image size: uint32 (4 bytes)
 * - Base image data: Buffer
 * - Variation count: uint32 (4 bytes)
 * - For each variation:
 *   - Name length: uint32 (4 bytes)
 *   - Name: UTF-8 string
 *   - Patch count: uint32 (4 bytes)
 *   - For each patch:
 *     - x: uint32 (4 bytes)
 *     - y: uint32 (4 bytes)
 *     - width: uint32 (4 bytes)
 *     - height: uint32 (4 bytes)
 *     - data size: uint32 (4 bytes)
 *     - data: Buffer
 */

import { CharPackData, VariationMetadata, DiffPatch } from './types';
// Use Brotli for balance between size and decode speed
import { compress, decompress } from './compress';
// Node 16+ provide explicit import path for Buffer type
import { Buffer } from 'node:buffer';
// File system operations for incremental modifications
import * as fs from 'fs/promises';

const MAGIC = Buffer.from('CHPK', 'utf8');
const VERSION = 1;

/**
 * Serialize CharPack data to buffer with variation index table for random access.
 * Index entry structure (per variation):
 *   - name length: uint32
 *   - name: UTF-8 bytes
 *   - data offset: uint32 (start offset of variation block)
 *   - data size: uint32 (length of variation block)
 */
export function serialize(data: CharPackData): Buffer {
  // Build buffers in three phases:
  // 1) Fixed-size header (magic, version, dims, base image)
  // 2) Index table (name, offset, size)
  // 3) Variation blocks (name + patches unchanged from previous format)

  const headerBuffers: Buffer[] = [];

  // Magic number
  headerBuffers.push(MAGIC);

  // Version
  const versionBuf = Buffer.allocUnsafe(4);
  versionBuf.writeUInt32LE(VERSION, 0);
  headerBuffers.push(versionBuf);

  // Dimensions & channel count
  const channels = data.baseImage.length / (data.width * data.height);
  const dimBuf = Buffer.allocUnsafe(9);
  dimBuf.writeUInt32LE(data.width, 0);
  dimBuf.writeUInt32LE(data.height, 4);
  dimBuf.writeUInt8(channels, 8);
  headerBuffers.push(dimBuf);

  // Base image (compressed)
  const compBase = compress(data.baseImage);
  const baseImgSizeBuf = Buffer.allocUnsafe(4);
  baseImgSizeBuf.writeUInt32LE(compBase.length, 0);
  headerBuffers.push(baseImgSizeBuf);
  headerBuffers.push(compBase);

  // Variation count (written before index)
  const varCountBuf = Buffer.allocUnsafe(4);
  varCountBuf.writeUInt32LE(data.variations.length, 0);
  headerBuffers.push(varCountBuf);

  // ------------------------------------------------------------
  // Build variation blocks first so we know their offsets/sizes
  // ------------------------------------------------------------
  const variationBlocks: Buffer[] = [];
  interface BlockInfo { nameBuf: Buffer; nameLenBuf: Buffer; blockSize: number; }
  const blockInfos: BlockInfo[] = [];

  for (const variation of data.variations) {
    // Variation name buffer
    const nameBuf = Buffer.from(variation.name, 'utf8');
    const nameLenBuf = Buffer.allocUnsafe(4);
    nameLenBuf.writeUInt32LE(nameBuf.length, 0);

    // Build patch block (includes patchCount and patches, *not* name)
    const patchesBufs: Buffer[] = [];
    const patchCountBuf = Buffer.allocUnsafe(4);
    patchCountBuf.writeUInt32LE(variation.patches.length, 0);
    patchesBufs.push(patchCountBuf);

    for (const patch of variation.patches) {
      const compPatch = compress(patch.data);
      const patchHeaderBuf = Buffer.allocUnsafe(20);
      patchHeaderBuf.writeUInt32LE(patch.rect.x, 0);
      patchHeaderBuf.writeUInt32LE(patch.rect.y, 4);
      patchHeaderBuf.writeUInt32LE(patch.rect.width, 8);
      patchHeaderBuf.writeUInt32LE(patch.rect.height, 12);
      patchHeaderBuf.writeUInt32LE(compPatch.length, 16);
      patchesBufs.push(patchHeaderBuf);
      patchesBufs.push(compPatch);
    }

    const patchBlock = Buffer.concat(patchesBufs);
    variationBlocks.push(patchBlock);

    blockInfos.push({ nameBuf, nameLenBuf, blockSize: patchBlock.length });
  }

  // ------------------------------------------------------------
  // Build index table now that we know sizes
  // ------------------------------------------------------------
  const indexBuffers: Buffer[] = [];
  let currentOffset = headerBuffers.reduce((sum, b) => sum + b.length, 0);
  // Add size of index table itself (we calculate dynamically as we build)
  // We'll grow currentOffset as we push entries, but need the final value for blocks.

  // First, pre-compute total index size to set starting offset of first block
  const indexSize = blockInfos.reduce((acc, info) => acc + 4 + info.nameBuf.length + 4 + 4, 0);
  currentOffset += indexSize;

  // Now build index entries and update offsets for each block
  for (let i = 0; i < blockInfos.length; i++) {
    const info = blockInfos[i];

    // Entry layout: [nameLen][name][offset][size]
    indexBuffers.push(info.nameLenBuf);
    indexBuffers.push(info.nameBuf);

    const offsetBuf = Buffer.allocUnsafe(4);
    offsetBuf.writeUInt32LE(currentOffset, 0);
    indexBuffers.push(offsetBuf);

    const sizeBuf = Buffer.allocUnsafe(4);
    sizeBuf.writeUInt32LE(info.blockSize, 0);
    indexBuffers.push(sizeBuf);

    // Update offset for next block
    currentOffset += info.blockSize;
  }

  // ------------------------------------------------------------
  // Concatenate all sections: header, index, blocks
  // ------------------------------------------------------------
  return Buffer.concat([...headerBuffers, ...indexBuffers, ...variationBlocks]);
}

/**
 * Lightweight variation index information extracted from header.
 */
export interface VariationIndex {
  name: string;
  offset: number;
  size: number;
}

/**
 * Parse CharPack header and index table without reading variation blocks.
 * Returns the base image buffer (decompressed) and variation indices for random access.
 */
export function parseHeaderWithIndex(buffer: Buffer): {
  width: number;
  height: number;
  channels: number;
  baseImage: Buffer;
  variations: VariationIndex[];
} {
  let offset = 0;

  // Magic
  const magic = buffer.subarray(offset, offset + 4);
  offset += 4;
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid CharPack file: magic mismatch');
  }

  // Version
  const version = buffer.readUInt32LE(offset);
  offset += 4;
  if (version !== VERSION) {
    throw new Error(`Unsupported CharPack version: ${version}`);
  }

  // Dimensions & channels
  const width = buffer.readUInt32LE(offset);
  offset += 4;
  const height = buffer.readUInt32LE(offset);
  offset += 4;
  const channels = buffer.readUInt8(offset);
  offset += 1;

  // Base image
  const baseImgSize = buffer.readUInt32LE(offset);
  offset += 4;
  const compBase = buffer.subarray(offset, offset + baseImgSize);
  offset += baseImgSize;
  const baseImage = decompress(compBase);

  // Variation count
  const varCount = buffer.readUInt32LE(offset);
  offset += 4;

  const variations: VariationIndex[] = [];
  for (let i = 0; i < varCount; i++) {
    const nameLen = buffer.readUInt32LE(offset);
    offset += 4;
    const name = buffer.subarray(offset, offset + nameLen).toString('utf8');
    offset += nameLen;

    const dataOffset = buffer.readUInt32LE(offset);
    offset += 4;
    const dataSize = buffer.readUInt32LE(offset);
    offset += 4;

    variations.push({ name, offset: dataOffset, size: dataSize });
  }

  return { width, height, channels, baseImage, variations };
}

/**
 * Deserialize buffer to CharPack data
 */
export function deserialize(buffer: Buffer): CharPackData {
  // Reuse header parse util to obtain base metadata and index
  const { width, height, channels, baseImage, variations: index } =
    parseHeaderWithIndex(buffer);

  const variations: VariationMetadata[] = [];

  for (const entry of index) {
    let offset = entry.offset;

    // Patch count
    const patchCount = buffer.readUInt32LE(offset);
    offset += 4;

    const patches: DiffPatch[] = [];
    for (let i = 0; i < patchCount; i++) {
      const x = buffer.readUInt32LE(offset);
      offset += 4;
      const y = buffer.readUInt32LE(offset);
      offset += 4;
      const patchWidth = buffer.readUInt32LE(offset);
      offset += 4;
      const patchHeight = buffer.readUInt32LE(offset);
      offset += 4;
      const dataSize = buffer.readUInt32LE(offset);
      offset += 4;

      const compData = buffer.subarray(offset, offset + dataSize);
      offset += dataSize;
      const data = decompress(compData);

      patches.push({
        rect: { x, y, width: patchWidth, height: patchHeight },
        data: Buffer.from(data),
      });
    }

    variations.push({ name: entry.name, patches });
  }

  return {
    version: VERSION,
    width,
    height,
    format: 'raw',
    baseImage: Buffer.from(baseImage),
    variations,
  };
}

/**
 * Incrementally add variations to an existing CharPack file
 * This creates a new file with the added variations
 */
export async function addVariationsToFile(
  filePath: string,
  newVariations: VariationMetadata[],
  baseImage: Buffer,
  width: number,
  height: number,
  channels: number
): Promise<void> {
  // Read the entire current file
  const currentBuffer = await fs.readFile(filePath);
  const { variations: currentIndex } = parseHeaderWithIndex(currentBuffer);

  // Check for name conflicts
  const existingNames = new Set(currentIndex.map(v => v.name));
  for (const variation of newVariations) {
    if (existingNames.has(variation.name)) {
      throw new Error(`Variation '${variation.name}' already exists in CharPack`);
    }
  }

  // Read all existing variation blocks
  const existingBlocks: Buffer[] = [];
  for (const variation of currentIndex) {
    const blockBuffer = Buffer.allocUnsafe(variation.size);
    // Note: offset is from start of file, so we read from currentBuffer
    currentBuffer.copy(blockBuffer, 0, variation.offset, variation.offset + variation.size);
    existingBlocks.push(blockBuffer);
  }

  // Build new variation blocks
  const newVariationBlocks: Buffer[] = [];
  const newIndexEntries: VariationIndex[] = [];

  for (const variation of newVariations) {
    // Build patch block (same format as serialize function)
    const patchesBufs: Buffer[] = [];
    const patchCountBuf = Buffer.allocUnsafe(4);
    patchCountBuf.writeUInt32LE(variation.patches.length, 0);
    patchesBufs.push(patchCountBuf);

    for (const patch of variation.patches) {
      const compPatch = compress(patch.data);
      const patchHeaderBuf = Buffer.allocUnsafe(20);
      patchHeaderBuf.writeUInt32LE(patch.rect.x, 0);
      patchHeaderBuf.writeUInt32LE(patch.rect.y, 4);
      patchHeaderBuf.writeUInt32LE(patch.rect.width, 8);
      patchHeaderBuf.writeUInt32LE(patch.rect.height, 12);
      patchHeaderBuf.writeUInt32LE(compPatch.length, 16);
      patchesBufs.push(patchHeaderBuf);
      patchesBufs.push(compPatch);
    }

    const patchBlock = Buffer.concat(patchesBufs);
    newVariationBlocks.push(patchBlock);

    newIndexEntries.push({
      name: variation.name,
      offset: 0, // will be set by buildHeaderWithIndex
      size: patchBlock.length,
    });
  }

  // Create new CharPack data
  const newCharPackData = {
    version: 1,
    width,
    height,
    format: 'raw' as const,
    baseImage,
    variations: [
      // Existing variations with their patches extracted from blocks
      ...currentIndex.map((indexEntry, i) => {
        // Parse the existing block to get patches
        let offset = 0;
        const patchCount = existingBlocks[i].readUInt32LE(offset);
        offset += 4;

        const patches: any[] = [];
        for (let j = 0; j < patchCount; j++) {
          const x = existingBlocks[i].readUInt32LE(offset);
          offset += 4;
          const y = existingBlocks[i].readUInt32LE(offset);
          offset += 4;
          const patchWidth = existingBlocks[i].readUInt32LE(offset);
          offset += 4;
          const patchHeight = existingBlocks[i].readUInt32LE(offset);
          offset += 4;
          const dataSize = existingBlocks[i].readUInt32LE(offset);
          offset += 4;

          const compData = existingBlocks[i].subarray(offset, offset + dataSize);
          offset += dataSize;
          const data = decompress(compData);

          patches.push({
            rect: { x, y, width: patchWidth, height: patchHeight },
            data: Buffer.from(data),
          });
        }

        return {
          name: indexEntry.name,
          patches,
        };
      }),
      // New variations
      ...newVariations,
    ],
  };

  // Serialize the complete new CharPack
  const newBuffer = serialize(newCharPackData);

  // Write the new file
  await fs.writeFile(filePath, newBuffer);
}

/**
 * Incrementally remove variations from an existing CharPack file
 * This modifies the file in-place by updating the header and index
 * Note: The removed variation blocks remain in the file but are no longer referenced
 */
export async function removeVariationsFromFile(
  filePath: string,
  variationNames: string[]
): Promise<void> {
  const fileHandle = await fs.open(filePath, 'r+');

  try {
    // Read current header and index
    const headerBuffer = await fileHandle.readFile();
    const { width, height, channels, baseImage, variations: currentIndex } = parseHeaderWithIndex(headerBuffer);

    // Filter out variations to remove
    const remainingVariations = currentIndex.filter(v => !variationNames.includes(v.name));

    if (remainingVariations.length === 0) {
      throw new Error('Cannot remove all variations from CharPack');
    }

    // Build new header with filtered index
    const newHeaderBuffer = buildHeaderWithIndex(baseImage, remainingVariations, width, height, channels);

    // Write new header (overwrites old header and index)
    await fileHandle.write(newHeaderBuffer, 0, 0, 0);

    // Note: We don't truncate the file, so removed variation blocks remain
    // but are no longer accessible. This could be optimized with a separate
    // compaction operation if needed.
  } finally {
    await fileHandle.close();
  }
}

/**
 * Build header and index section for CharPack file
 * Used by incremental modification functions
 */
function buildHeaderWithIndex(
  baseImage: Buffer,
  variations: VariationIndex[],
  width: number,
  height: number,
  channels: number
): Buffer {
  const headerBuffers: Buffer[] = [];

  // Magic number
  headerBuffers.push(MAGIC);

  // Version
  const versionBuf = Buffer.allocUnsafe(4);
  versionBuf.writeUInt32LE(VERSION, 0);
  headerBuffers.push(versionBuf);

  // Dimensions & channel count
  const dimBuf = Buffer.allocUnsafe(9);
  dimBuf.writeUInt32LE(width, 0);
  dimBuf.writeUInt32LE(height, 4);
  dimBuf.writeUInt8(channels, 8);
  headerBuffers.push(dimBuf);

  // Base image (compressed)
  const compBase = compress(baseImage);
  const baseImgSizeBuf = Buffer.allocUnsafe(4);
  baseImgSizeBuf.writeUInt32LE(compBase.length, 0);
  headerBuffers.push(baseImgSizeBuf);
  headerBuffers.push(compBase);

  // Variation count
  const varCountBuf = Buffer.allocUnsafe(4);
  varCountBuf.writeUInt32LE(variations.length, 0);
  headerBuffers.push(varCountBuf);

  // Build index table
  const indexBuffers: Buffer[] = [];
  let currentOffset = headerBuffers.reduce((sum, b) => sum + b.length, 0);
  // Add size of index table itself
  const indexSize = variations.reduce((acc, v) => acc + 4 + Buffer.from(v.name, 'utf8').length + 4 + 4, 0);
  currentOffset += indexSize;

  // Build index entries
  for (const variation of variations) {
    const nameBuf = Buffer.from(variation.name, 'utf8');
    const nameLenBuf = Buffer.allocUnsafe(4);
    nameLenBuf.writeUInt32LE(nameBuf.length, 0);

    indexBuffers.push(nameLenBuf);
    indexBuffers.push(nameBuf);

    const offsetBuf = Buffer.allocUnsafe(4);
    offsetBuf.writeUInt32LE(currentOffset, 0);
    indexBuffers.push(offsetBuf);

    const sizeBuf = Buffer.allocUnsafe(4);
    sizeBuf.writeUInt32LE(variation.size, 0);
    indexBuffers.push(sizeBuf);

    currentOffset += variation.size;
  }

  return Buffer.concat([...headerBuffers, ...indexBuffers]);
}

