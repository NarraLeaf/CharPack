/**
 * Test read functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { charpack, extract, read } from '../';

describe('read', () => {
  const testInputDir = path.join(__dirname, 'ignored', 'input');
  const testOutputDir = path.join(__dirname, 'output');

  let charpackPath: string;

  beforeAll(async () => {
    // Create output directory
    await fs.mkdir(testOutputDir, { recursive: true });

    // Create a test charpack file
    charpackPath = path.join(testOutputDir, 'test-read.charpack');
    await charpack({
      input: {
        variation1: path.join(testInputDir, 'koi_tcr_bingfu_ts_lh_pm_wx_xy.png'),
        variation2: path.join(testInputDir, 'koi_tcr_bingfu_ts_lh_pm_zz2_xy.png'),
      },
      output: charpackPath,
    });
  });

  afterAll(async () => {
    // Clean up output files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('extract', () => {
    it('should extract single variation as PNG', async () => {
      const image = await extract(charpackPath, 'variation1');
      const pngBuffer = await image.png();

      expect(Buffer.isBuffer(pngBuffer)).toBe(true);
      expect(pngBuffer.length).toBeGreaterThan(0);
    });

    it('should extract single variation as JPEG', async () => {
      const image = await extract(charpackPath, 'variation1');
      const jpegBuffer = await image.jpeg();

      expect(Buffer.isBuffer(jpegBuffer)).toBe(true);
      expect(jpegBuffer.length).toBeGreaterThan(0);
    });

    it('should extract single variation as WebP', async () => {
      const image = await extract(charpackPath, 'variation1');
      const webpBuffer = await image.webp();

      expect(Buffer.isBuffer(webpBuffer)).toBe(true);
      expect(webpBuffer.length).toBeGreaterThan(0);
    });

    it('should extract single variation as base64', async () => {
      const image = await extract(charpackPath, 'variation1');
      const base64String = await image.base64();

      expect(typeof base64String).toBe('string');
      expect(base64String.length).toBeGreaterThan(0);
      expect(base64String.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should throw error for non-existent variation', async () => {
      await expect(
        extract(charpackPath, 'nonexistent')
      ).rejects.toThrow("Variation 'nonexistent' not found in CharPack");
    });
  });

  describe('read', () => {
    it('should read multiple variations efficiently', async () => {
      const pack = await read(charpackPath);

      const png1 = await pack.png('variation1');
      const png2 = await pack.png('variation2');

      expect(Buffer.isBuffer(png1)).toBe(true);
      expect(Buffer.isBuffer(png2)).toBe(true);
      expect(png1.length).toBeGreaterThan(0);
      expect(png2.length).toBeGreaterThan(0);

      pack.dispose();
    });

    it('should support multiple formats when reading', async () => {
      const pack = await read(charpackPath);

      const jpeg = await pack.jpeg('variation1');
      const webp = await pack.webp('variation1');
      const base64 = await pack.base64('variation1');

      expect(Buffer.isBuffer(jpeg)).toBe(true);
      expect(Buffer.isBuffer(webp)).toBe(true);
      expect(typeof base64).toBe('string');

      pack.dispose();
    });

    it('should refresh data from disk', async () => {
      const pack = await read(charpackPath);

      // Get initial data
      const initialPng = await pack.png('variation1');

      // Refresh (reload from disk)
      await pack.refresh();

      // Get data again
      const refreshedPng = await pack.png('variation1');

      expect(Buffer.isBuffer(refreshedPng)).toBe(true);
      expect(refreshedPng.length).toBe(initialPng.length);

      pack.dispose();
    });

    it('should throw error for non-existent variation when reading', async () => {
      const pack = await read(charpackPath);

      await expect(
        pack.png('nonexistent')
      ).rejects.toThrow("Variation 'nonexistent' not found in CharPack");

      pack.dispose();
    });
  });
});
