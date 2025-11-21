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
  /**
   * Size of the blocks to use when diffing images.
   * Smaller blocks provide more precise patches but may result in more
   * patches and larger file sizes. Larger blocks are faster but less precise.
   * @default 32
   * @range 4-128 recommended
   */
  blockSize?: number;

  /**
   * Per-channel absolute difference tolerance (0-255).
   *
   * When set, pixels are considered identical if the absolute difference
   * on each color channel (R,G,B,A) is ≤ this threshold.
   *
   * - **Use case**: Filter per-channel noise like compression artifacts,
   *   sharpening halos, or scanner dust.
   * - **Example**: diffThreshold: 3 tolerates ±3 difference per channel
   * - **Performance**: Fast, simple per-channel comparison
   * - **Limitation**: Doesn't consider color perception (e.g., (3,0,0) vs (0,3,0))
   *
   * Ignored when colorDistanceThreshold > 0.
   * @default 0 (strict equality)
   */
  diffThreshold?: number;

  /**
   * Euclidean color distance tolerance in RGB space (0-441.7).
   *
   * When set, pixels are considered identical if the Euclidean distance
   * between their RGB colors is ≤ this threshold. This matches human
   * color perception better than per-channel differences.
   *
   * - **Formula**: sqrt((R1-R2)² + (G1-G2)² + (B1-B2)²)
   * - **Use case**: Filter subtle color shifts, lighting variations,
   *   or minor color grading differences.
   * - **Example**: colorDistanceThreshold: 5 tolerates small color drifts
   * - **Advantage**: Perceptually uniform (red/green swap is treated equally)
   * - **Performance**: Slower than diffThreshold due to sqrt calculation
   *
   * Takes precedence over diffThreshold when > 0.
   * @default 0 (use diffThreshold instead)
   */
  colorDistanceThreshold?: number;

  /**
   * Fuzzy tolerance ratio for block-level differences (0-1).
   *
   * Allows a block to be considered unchanged even if some pixels differ,
   * as long as the ratio of differing pixels doesn't exceed this threshold.
   * This enables neighborhood-aware compression that tolerates scattered noise.
   *
   * - **Use case**: Handle images with salt/pepper noise, film grain,
   *   or minor compression artifacts that affect isolated pixels.
   * - **Example**: diffToleranceRatio: 0.05 allows 5% of pixels in a block to differ
   * - **Interaction**: Works with both diffThreshold and colorDistanceThreshold
   * - **Trade-off**: Higher values improve compression but may lose fine details
   *
   * @default 0 (any differing pixel makes the block different)
   */
  diffToleranceRatio?: number;
}

/**
 * CharPack API for getting images in different formats
 */
export interface CharPackImage {
  png(): Promise<Buffer>;
  jpeg(): Promise<Buffer>;
  webp(): Promise<Buffer>;
  base64(): Promise<string>;
}

/**
 * In-memory CharPack for efficient multi-variation reading and modification
 */
export interface CharPack {
  png(variation: string): Promise<Buffer>;
  jpeg(variation: string): Promise<Buffer>;
  webp(variation: string): Promise<Buffer>;
  base64(variation: string): Promise<string>;
  dispose(): void;
  refresh(): void;
  add(input: string | string[] | Record<string, string>, config?: PackConfig): Promise<void>;
  remove(variation: string): Promise<void>;
  list(): Promise<string[]>;
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
  data: Buffer; // PNG buffer representing this region (RGBA)
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

