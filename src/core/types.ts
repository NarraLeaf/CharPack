/**
 * Core type definitions for CharPack
 */

/**
 * Configuration for packing images
 */
export interface PackConfig {
  /**
   * Whether to include the extension in the variation name.
   * @default true
   */
  withExtension?: boolean;
  /**
   * A function to customize the variation name.
   */
  variationName?: (filePath: string) => string;
}

/**
 * CharPack API for getting images in different formats
 */
export interface CharPack {
  png(): Promise<Buffer>;
  jpeg(): Promise<Buffer>;
  webp(): Promise<Buffer>;
  base64(): Promise<string>;
}

/**
 * In-memory CharPack for efficient multi-variation reading
 */
export interface MemoryCharPack {
  png(variation: string): Promise<Buffer>;
  jpeg(variation: string): Promise<Buffer>;
  webp(variation: string): Promise<Buffer>;
  base64(variation: string): Promise<string>;
  dispose(): void;
  refresh(): void;
}

/**
 * Rectangle representing a region in an image
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Diff patch representing a region that differs from base image
 */
export interface DiffPatch {
  rect: Rectangle;
  data: Buffer; // Raw pixel data for this region
}

/**
 * Metadata for a single variation
 */
export interface VariationMetadata {
  name: string;
  patches: DiffPatch[];
}

/**
 * Complete CharPack file structure
 */
export interface CharPackData {
  version: number;
  width: number;
  height: number;
  format: 'png' | 'raw'; // Format of base image and patches
  baseImage: Buffer;
  variations: VariationMetadata[];
}

/**
 * Raw image data with metadata
 */
export interface RawImageData {
  width: number;
  height: number;
  channels: number; // 3 for RGB, 4 for RGBA
  data: Buffer; // Raw pixel data
}

