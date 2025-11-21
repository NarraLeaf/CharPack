/**
 * Browser read functionality using Canvas API
 */

// Browser-compatible types
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DiffPatch {
  rect: Rectangle;
  data: Buffer;
}

interface VariationMetadata {
  name: string;
  patches: DiffPatch[];
}

interface CharPackData {
  version: number;
  width: number;
  height: number;
  format: 'raw';
  baseImage: Buffer;
  variations: VariationMetadata[];
}

interface RawImageData {
  width: number;
  height: number;
  channels: number;
  data: Buffer;
}

interface CharPackImage {
  png(): Promise<Buffer>;
  jpeg(): Promise<Buffer>;
  webp(): Promise<Buffer>;
  base64(): Promise<string>;
}

interface MemoryCharPack {
  png(variation: string): Promise<Buffer>;
  jpeg(variation: string): Promise<Buffer>;
  webp(variation: string): Promise<Buffer>;
  base64(variation: string): Promise<string>;
  dispose(): void;
  list(): Promise<string[]>;
}

interface VariationIndex {
  name: string;
  offset: number;
  size: number;
}

// Browser-compatible Buffer polyfill
const Buffer = globalThis.Buffer || {
  from: (data: any) => {
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return data;
  },
  allocUnsafe: (size: number) => new Uint8Array(size),
  concat: (buffers: Uint8Array[]) => {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  },
  isBuffer: (obj: any) => obj instanceof Uint8Array,
};

// Browser-compatible compression using pako
import { deflate, inflate } from 'pako';

function compress(buf: Uint8Array): Uint8Array {
  const result = deflate(buf, { level: 6 });
  return result;
}

function decompress(buf: Uint8Array): Uint8Array {
  const result = inflate(buf);
  return result;
}

// Browser-compatible image processing
import { toPNG, toJPEG, toWebP, toBase64 } from './image-processor';

// Constants
const MAGIC = Buffer.from('CHPK', 'utf8');
const VERSION = 1;

/**
 * Parse CharPack header and index table without reading variation blocks.
 */
function parseHeaderWithIndex(buffer: Uint8Array): {
  width: number;
  height: number;
  channels: number;
  baseImage: Uint8Array;
  variations: VariationIndex[];
} {
  let offset = 0;

  // Magic
  const magic = buffer.subarray(offset, offset + 4);
  offset += 4;
  if (!magic.every((byte, i) => byte === MAGIC[i])) {
    throw new Error('Invalid CharPack file: magic mismatch');
  }

  // Version
  const version = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  offset += 4;
  if (version !== VERSION) {
    throw new Error(`Unsupported CharPack version: ${version}`);
  }

  // Dimensions & channels
  const width = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  offset += 4;
  const height = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  offset += 4;
  const channels = buffer[offset];
  offset += 1;

  // Base image
  const baseImgSize = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  offset += 4;
  const compBase = buffer.subarray(offset, offset + baseImgSize);
  offset += baseImgSize;
  const baseImage = decompress(compBase);

  // Variation count
  const varCount = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  offset += 4;

  const variations: VariationIndex[] = [];
  for (let i = 0; i < varCount; i++) {
    const nameLen = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    const name = new TextDecoder().decode(buffer.subarray(offset, offset + nameLen));
    offset += nameLen;

    const dataOffset = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    const dataSize = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;

    variations.push({ name, offset: dataOffset, size: dataSize });
  }

  return { width, height, channels, baseImage, variations };
}

/**
 * Deserialize buffer to CharPack data
 */
function deserialize(buffer: Uint8Array): CharPackData {
  // Reuse header parse util to obtain base metadata and index
  const { width, height, channels, baseImage, variations: index } =
    parseHeaderWithIndex(buffer);

  const variations: VariationMetadata[] = [];

  for (const entry of index) {
    let offset = entry.offset;

    // Patch count
    const patchCount = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;

    const patches: DiffPatch[] = [];
    for (let i = 0; i < patchCount; i++) {
      const x = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
      offset += 4;
      const y = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
      offset += 4;
      const patchWidth = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
      offset += 4;
      const patchHeight = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
      offset += 4;
      const dataSize = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
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
 * Apply patches to a base image to reconstruct the target image
 */
async function applyPatches(
  baseImage: RawImageData,
  patches: DiffPatch[]
): Promise<RawImageData> {
  // Clone base image data
  const resultData = Buffer.from(baseImage.data);

  for (const patch of patches) {
    const { x, y, width, height } = patch.rect;

    // Decode patch data - in browser version, patches are stored as raw RGBA data
    // (not PNG-encoded like in node version)
    const patchData = patch.data;

    let patchOffset = 0;
    for (let dy = 0; dy < height; dy++) {
      const targetOffset = ((y + dy) * baseImage.width + x) * baseImage.channels;
      const bytesToCopy = width * baseImage.channels;
      resultData.set(patchData.subarray(patchOffset, patchOffset + bytesToCopy), targetOffset);
      patchOffset += bytesToCopy;
    }
  }

  return {
    width: baseImage.width,
    height: baseImage.height,
    channels: baseImage.channels,
    data: resultData,
  };
}

/**
 * Extract a single variation from CharPack buffer
 */
export async function extract(input: Buffer | Uint8Array, variation: string): Promise<CharPackImage> {
  // Ensure input is Uint8Array
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);

  // Read header and index table
  const { width, height, channels, baseImage, variations: index } =
    parseHeaderWithIndex(buffer);

  // Find the requested variation in index
  const varEntry = index.find((v) => v.name === variation);
  if (!varEntry) {
    throw new Error(`Variation '${variation}' not found in CharPack`);
  }

  // Read variation patch data
  let offset = varEntry.offset;

  // Patch count
  const patchCount = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  offset += 4;

  const patches: DiffPatch[] = [];
  for (let i = 0; i < patchCount; i++) {
    const x = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    const y = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    const patchWidth = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    const patchHeight = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;
    const dataSize = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    offset += 4;

    const compData = buffer.subarray(offset, offset + dataSize);
    offset += dataSize;
    const data = decompress(compData);

    patches.push({
      rect: { x, y, width: patchWidth, height: patchHeight },
      data: Buffer.from(data),
    });
  }

  const baseImageData: RawImageData = {
    width,
    height,
    channels,
    data: Buffer.from(baseImage),
  };

  const image = await applyPatches(baseImageData, patches);

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
export async function read(input: Buffer | Uint8Array): Promise<MemoryCharPack> {
  // Ensure input is Uint8Array
  let buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
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
    list: async () => {
      return charPackData.variations.map(v => v.name);
    },
  };
}

/**
 * Unpack all variations from CharPack buffer
 */
export function unpack(
  input: Buffer | Uint8Array,
  callback: (images: Record<string, Buffer>) => void
): void;

/**
 * Unpack specific variations from CharPack buffer
 */
export function unpack(
  input: Buffer | Uint8Array,
  variations: string[],
  callback: (images: Record<string, Buffer>) => void
): void;

/**
 * Unpack variations from CharPack buffer
 */
export function unpack(
  input: Buffer | Uint8Array,
  variationsOrCallback: string[] | ((images: Record<string, Buffer>) => void),
  callback?: (images: Record<string, Buffer>) => void
): void {
  const processUnpack = async () => {
    try {
      const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
      const charPackData = deserialize(buffer);

      const baseImage: RawImageData = {
        width: charPackData.width,
        height: charPackData.height,
        channels: charPackData.baseImage.length / (charPackData.width * charPackData.height),
        data: charPackData.baseImage,
      };

      const images: Record<string, Buffer> = {};
      const targetVariations = typeof variationsOrCallback === 'function'
        ? charPackData.variations.map(v => v.name)
        : variationsOrCallback;
      const actualCallback = typeof variationsOrCallback === 'function'
        ? variationsOrCallback
        : callback!;

      for (const variationName of targetVariations) {
        const varMeta = charPackData.variations.find((v) => v.name === variationName);
        if (!varMeta) {
          throw new Error(`Variation '${variationName}' not found in CharPack`);
        }

        const image = await applyPatches(baseImage, varMeta.patches);
        const pngBuffer = await toPNG(image);
        images[variationName] = pngBuffer;
      }

      actualCallback(images);
    } catch (error) {
      console.error('Failed to unpack CharPack:', error);
      // In browser environment, we can't throw from async callback
      // Instead, we'll call the callback with an empty object to indicate failure
      const actualCallback = typeof variationsOrCallback === 'function'
        ? variationsOrCallback
        : callback!;
      actualCallback({});
    }
  };

  // Execute asynchronously
  processUnpack();
}
