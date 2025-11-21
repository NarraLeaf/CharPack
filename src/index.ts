/**
 * CharPack - Node.js Entry Point
 * Image compression tool optimized for character illustrations
 */

export { charpack } from './node/pack';
export { unpack } from './node/unpack';
export { extract, read, visualizeCompression, visualizeVariationPatches, visualizeVariationPatchesFromData } from './node/read';
export { deserialize } from './core/format';
export { applyPatches } from './core/diff';
export { toPNG } from './node/image-processor';

export type { PackConfig, CharPack, MemoryCharPack } from './core/types';
