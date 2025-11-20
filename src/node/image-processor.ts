/**
 * Node.js image processor using Sharp
 */

import sharp from 'sharp';
import { RawImageData } from '../core/types';

/**
 * Load image from file path and convert to raw pixel data
 */
export async function loadImage(filePath: string): Promise<RawImageData> {
  const image = sharp(filePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Invalid image dimensions for ${filePath}`);
  }

  const { data, info } = await image
    .ensureAlpha() // Ensure RGBA format
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    channels: info.channels as number,
    data,
  };
}

/**
 * Load image from buffer and convert to raw pixel data
 */
export async function loadImageFromBuffer(buffer: Buffer): Promise<RawImageData> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image dimensions');
  }

  const { data, info } = await image
    .ensureAlpha() // Ensure RGBA format
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    channels: info.channels as number,
    data,
  };
}

/**
 * Convert raw pixel data to PNG buffer
 */
export async function toPNG(image: RawImageData): Promise<Buffer> {
  return sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: image.channels as 1 | 2 | 3 | 4,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Convert raw pixel data to JPEG buffer
 */
export async function toJPEG(image: RawImageData): Promise<Buffer> {
  return sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: image.channels as 1 | 2 | 3 | 4,
    },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Convert raw pixel data to WebP buffer
 */
export async function toWebP(image: RawImageData): Promise<Buffer> {
  return sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: image.channels as 1 | 2 | 3 | 4,
    },
  })
    .webp()
    .toBuffer();
}

/**
 * Convert raw pixel data to base64 string (PNG format)
 */
export async function toBase64(image: RawImageData): Promise<string> {
  const pngBuffer = await toPNG(image);
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

