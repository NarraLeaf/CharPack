/**
 * Browser-compatible image diffing functions
 * Canvas-based implementation without sharp dependency
 */

import { RawImageData, DiffPatch } from '../core/types';

/**
 * Apply patches to a base image to reconstruct the target image
 * Browser version using Canvas API instead of sharp
 */
export async function applyPatches(
  baseImage: RawImageData,
  patches: DiffPatch[]
): Promise<RawImageData> {
  // Clone base image data
  const resultData = Buffer.from(baseImage.data);

  for (const patch of patches) {
    const { x, y, width, height } = patch.rect;

    // Decode PNG patch to raw buffer using Canvas API
    const patchImage = await decodePNGToRaw(patch.data);

    if (patchImage.channels !== baseImage.channels) {
      throw new Error('Channel mismatch between base image and patch image');
    }

    let patchOffset = 0;
    for (let dy = 0; dy < height; dy++) {
      const targetOffset = ((y + dy) * baseImage.width + x) * baseImage.channels;
      patchImage.data.copy(resultData, targetOffset, patchOffset, patchOffset + width * baseImage.channels);
      patchOffset += width * baseImage.channels;
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
 * Decode PNG buffer to raw pixel data using Canvas API
 */
async function decodePNGToRaw(pngBuffer: Buffer): Promise<RawImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);

      resolve({
        width: canvas.width,
        height: canvas.height,
        channels: 4, // RGBA
        data: Buffer.from(imageData.data),
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load PNG image'));
    };

    img.src = url;
  });
}
