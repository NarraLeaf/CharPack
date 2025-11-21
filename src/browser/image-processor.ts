/**
 * Browser image processor using Canvas API
 */

import { RawImageData } from '../core/types';

/**
 * Load image from buffer and convert to raw pixel data using Canvas API
 */
export async function loadImageFromBuffer(buffer: ArrayBuffer): Promise<RawImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: 'image/png' }); // Assume PNG for now
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = new Uint8Array(imageData.data.buffer);

        resolve({
          width: img.width,
          height: img.height,
          channels: 4, // RGBA
          data: Buffer.from(data),
        });
      } catch (error) {
        reject(new Error(`Failed to process image: ${error}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Convert raw pixel data to PNG buffer using Canvas API
 */
export async function toPNG(image: RawImageData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;

      // Create ImageData from raw buffer
      const imageData = new ImageData(
        new Uint8ClampedArray(image.data),
        image.width,
        image.height
      );

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create PNG blob'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          resolve(Buffer.from(arrayBuffer));
        };
        reader.onerror = () => {
          reject(new Error('Failed to read PNG blob'));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    } catch (error) {
      reject(new Error(`Failed to convert to PNG: ${error}`));
    }
  });
}

/**
 * Convert raw pixel data to JPEG buffer using Canvas API
 */
export async function toJPEG(image: RawImageData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;

      // Create ImageData from raw buffer
      const imageData = new ImageData(
        new Uint8ClampedArray(image.data),
        image.width,
        image.height
      );

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create JPEG blob'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          resolve(Buffer.from(arrayBuffer));
        };
        reader.onerror = () => {
          reject(new Error('Failed to read JPEG blob'));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/jpeg', 0.9); // 90% quality
    } catch (error) {
      reject(new Error(`Failed to convert to JPEG: ${error}`));
    }
  });
}

/**
 * Convert raw pixel data to WebP buffer using Canvas API
 */
export async function toWebP(image: RawImageData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;

      // Create ImageData from raw buffer
      const imageData = new ImageData(
        new Uint8ClampedArray(image.data),
        image.width,
        image.height
      );

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create WebP blob'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          resolve(Buffer.from(arrayBuffer));
        };
        reader.onerror = () => {
          reject(new Error('Failed to read WebP blob'));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/webp', 0.9); // 90% quality
    } catch (error) {
      reject(new Error(`Failed to convert to WebP: ${error}`));
    }
  });
}

/**
 * Convert raw pixel data to base64 string (PNG format)
 */
export async function toBase64(image: RawImageData): Promise<string> {
  const pngBuffer = await toPNG(image);
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
