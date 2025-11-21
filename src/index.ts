/**
 * CharPack - Node.js Entry Point
 * Image compression tool optimized for character illustrations
 */

export { charpack } from './node/pack';
export { unpack } from './node/unpack';
export { extract, read, visualizeCompression, visualizeVariationPatches, visualizeVariationPatchesFromData } from './node/read';
export { deserialize, parseHeaderWithIndex } from './core/format';
export { applyPatches } from './core/diff';
export { toPNG } from './node/image-processor';

export type { PackConfig, CharPackImage as CharPack, CharPack as MemoryCharPack } from './core/types';
