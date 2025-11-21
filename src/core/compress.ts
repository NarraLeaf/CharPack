import { deflate, inflate } from 'pako';

/**
 * Compress buffer using DEFLATE (pako)
 */
export function compress(buf: Buffer): Buffer {
  const result = deflate(buf, { level: 6 }); // balanced ratio & speed
  return Buffer.from(result);
}

/**
 * Decompress buffer using INFLATE (pako)
 */
export function decompress(buf: Buffer): Buffer {
  const result = inflate(buf);
  return Buffer.from(result);
}
