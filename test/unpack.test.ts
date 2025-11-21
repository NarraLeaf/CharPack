/**
 * Test unpack functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { charpack, unpack, visualizeCompression } from '../';

describe('unpack', () => {
  const testInputDir = path.join(__dirname, 'ignored', 'input');
  const testOutputDir = path.join(__dirname, 'output');
  const unpackOutputDir = path.join(testOutputDir, 'unpacked');

  let charpackPath: string;

  beforeAll(async () => {
    // Create output directories
    await fs.mkdir(testOutputDir, { recursive: true });
    await fs.mkdir(unpackOutputDir, { recursive: true });

    // Create a test charpack file
    charpackPath = path.join(testOutputDir, 'test-unpack.charpack');
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
      // await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should unpack all variations to directory', async () => {
    const result = await unpack(charpackPath, unpackOutputDir);

    expect(result).toHaveProperty('variation1');
    expect(result).toHaveProperty('variation2');

    // Verify output files exist
    const stats1 = await fs.stat(result.variation1);
    const stats2 = await fs.stat(result.variation2);
    expect(stats1.size).toBeGreaterThan(0);
    expect(stats2.size).toBeGreaterThan(0);
  });

  it('should unpack single variation to file', async () => {
    const outputPath = path.join(testOutputDir, 'single-variation.png');
    const result = await unpack(charpackPath, outputPath, 'variation1');

    expect(result).toHaveProperty('variation1');
    expect(result.variation1).toBe(outputPath);

    // Verify output file exists
    const stats = await fs.stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should unpack multiple variations to files', async () => {
    const output1 = path.join(testOutputDir, 'multi1.png');
    const output2 = path.join(testOutputDir, 'multi2.png');

    const result = await unpack(charpackPath, {
      variation1: output1,
      variation2: output2,
    });

    expect(result).toHaveProperty('variation1');
    expect(result).toHaveProperty('variation2');
    expect(result.variation1).toBe(output1);
    expect(result.variation2).toBe(output2);

    // Verify output files exist
    const stats1 = await fs.stat(output1);
    const stats2 = await fs.stat(output2);
    expect(stats1.size).toBeGreaterThan(0);
    expect(stats2.size).toBeGreaterThan(0);
  });

  it('should throw error for non-existent variation', async () => {
    const outputPath = path.join(testOutputDir, 'nonexistent.png');

    await expect(
      unpack(charpackPath, outputPath, 'nonexistent')
    ).rejects.toThrow("Variation 'nonexistent' not found in CharPack");
  });

  it('should create compression visualization', async () => {
    const visualizationPath = path.join(testOutputDir, 'visualization-test.png');

    const visualization = await visualizeCompression(charpackPath);
    const pngBuffer = await visualization.png();
    await fs.writeFile(visualizationPath, pngBuffer);

    // Verify output file exists and has content
    const stats = await fs.stat(visualizationPath);
    expect(stats.size).toBeGreaterThan(0);

    // Clean up
    await fs.unlink(visualizationPath);
  }, 60 * 1000);
});
