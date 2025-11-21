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

const MAGIC = Buffer.from('CHPK', 'utf8');
const VERSION = 1;

/**
 * Serialize CharPack data to buffer
 */
export function serialize(data: CharPackData): Buffer {
  const buffers: Buffer[] = [];
  
  // Magic number
  buffers.push(MAGIC);
  
  // Version
  const versionBuf = Buffer.allocUnsafe(4);
  versionBuf.writeUInt32LE(VERSION, 0);
  buffers.push(versionBuf);
  
  // Dimensions
  // Determine channels *before* compression
  const channels = data.baseImage.length / (data.width * data.height);

  const dimBuf = Buffer.allocUnsafe(9);
  dimBuf.writeUInt32LE(data.width, 0);
  dimBuf.writeUInt32LE(data.height, 4);
  dimBuf.writeUInt8(channels, 8); // channels
  buffers.push(dimBuf);
  
  // Compress base image via pako deflate
  const compBase = compress(data.baseImage);

  const baseImgSizeBuf = Buffer.allocUnsafe(4);
  baseImgSizeBuf.writeUInt32LE(compBase.length, 0);
  buffers.push(baseImgSizeBuf);
  buffers.push(compBase);
  
  // Variation count
  const varCountBuf = Buffer.allocUnsafe(4);
  varCountBuf.writeUInt32LE(data.variations.length, 0);
  buffers.push(varCountBuf);
  
  // Each variation
  for (const variation of data.variations) {
    // Name
    const nameBuf = Buffer.from(variation.name, 'utf8');
    const nameLenBuf = Buffer.allocUnsafe(4);
    nameLenBuf.writeUInt32LE(nameBuf.length, 0);
    buffers.push(nameLenBuf);
    buffers.push(nameBuf);
    
    // Patch count
    const patchCountBuf = Buffer.allocUnsafe(4);
    patchCountBuf.writeUInt32LE(variation.patches.length, 0);
    buffers.push(patchCountBuf);
    
    // Each patch
    for (const patch of variation.patches) {
      // Compress patch data
      const compPatch = compress(patch.data);

      const patchHeaderBuf = Buffer.allocUnsafe(20);
      patchHeaderBuf.writeUInt32LE(patch.rect.x, 0);
      patchHeaderBuf.writeUInt32LE(patch.rect.y, 4);
      patchHeaderBuf.writeUInt32LE(patch.rect.width, 8);
      patchHeaderBuf.writeUInt32LE(patch.rect.height, 12);
      patchHeaderBuf.writeUInt32LE(compPatch.length, 16);
      buffers.push(patchHeaderBuf);
      buffers.push(compPatch);
    }
  }
  
  return Buffer.concat(buffers);
}

/**
 * Deserialize buffer to CharPack data
 */
export function deserialize(buffer: Buffer): CharPackData {
  let offset = 0;
  
  // Check magic number
  const magic = buffer.subarray(offset, offset + 4);
  offset += 4;
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid CharPack file: magic number mismatch');
  }
  
  // Version
  const version = buffer.readUInt32LE(offset);
  offset += 4;
  if (version !== VERSION) {
    throw new Error(`Unsupported CharPack version: ${version}`);
  }
  
  // Dimensions
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
  
  // Variations
  const varCount = buffer.readUInt32LE(offset);
  offset += 4;
  
  const variations: VariationMetadata[] = [];
  for (let i = 0; i < varCount; i++) {
    // Name
    const nameLen = buffer.readUInt32LE(offset);
    offset += 4;
    const name = buffer.subarray(offset, offset + nameLen).toString('utf8');
    offset += nameLen;
    
    // Patches
    const patchCount = buffer.readUInt32LE(offset);
    offset += 4;
    
    const patches: DiffPatch[] = [];
    for (let j = 0; j < patchCount; j++) {
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
        data: Buffer.from(data), // Copy to ensure independence
      });
    }
    
    variations.push({ name, patches });
  }
  
  return {
    version,
    width,
    height,
    format: 'raw',
    baseImage: Buffer.from(baseImage), // Copy to ensure independence
    variations,
  };
}

