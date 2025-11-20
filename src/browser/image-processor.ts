/**
 * Browser image processor using Canvas API
 */

import { RawImageData } from '../core/types';

/**
 * Load image from buffer and convert to raw pixel data
 */
export async function loadImageFromBuffer(buffer: Buffer): Promise<RawImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([new Uint8Array(buffer)]);
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
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Convert raw pixel data to PNG buffer
 */
export async function toPNG(image: RawImageData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(image.data),
      image.width,
      image.height
    );
    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }

      blob.arrayBuffer().then((arrayBuffer: ArrayBuffer) => {
        resolve(Buffer.from(arrayBuffer));
      });
    }, 'image/png');
  });
}

/**
 * Convert raw pixel data to JPEG buffer
 */
export async function toJPEG(image: RawImageData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(image.data),
      image.width,
      image.height
    );
    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }

      blob.arrayBuffer().then((arrayBuffer: ArrayBuffer) => {
        resolve(Buffer.from(arrayBuffer));
      });
    }, 'image/jpeg');
  });
}

/**
 * Convert raw pixel data to WebP buffer
 */
export async function toWebP(image: RawImageData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(image.data),
      image.width,
      image.height
    );
    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }

      blob.arrayBuffer().then((arrayBuffer: ArrayBuffer) => {
        resolve(Buffer.from(arrayBuffer));
      });
    }, 'image/webp');
  });
}

/**
 * Convert raw pixel data to base64 string (PNG format)
 */
export async function toBase64(image: RawImageData): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(image.data),
      image.width,
      image.height
    );
    ctx.putImageData(imageData, 0, 0);

    resolve(canvas.toDataURL('image/png'));
  });
}

