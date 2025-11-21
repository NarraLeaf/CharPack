/**
 * Test pack functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { charpack } from '../';

/**
 * Calculate total size of input files
 */
async function calculateInputSize(input: string | string[] | Record<string, string>): Promise<number> {
  let filePaths: string[] = [];

  if (typeof input === 'string') {
    // Glob pattern - resolve to file paths
    filePaths = await glob(input, { nodir: true });
  } else if (Array.isArray(input)) {
    // Array of paths
    filePaths = input;
  } else {
    // Name-path mapping - get values (file paths)
    filePaths = Object.values(input);
  }

  let totalSize = 0;
  for (const filePath of filePaths) {
    try {
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    } catch (error) {
      throw new Error(`Failed to get size for file ${filePath}: ${error}`);
    }
  }

  return totalSize;
}

describe('pack', () => {
  const testInputDir = path.join(__dirname, 'ignored', 'input');
  const testOutputDir = path.join(__dirname, 'output');

  beforeAll(async () => {
    // Create output directory if it doesn't exist
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up output files
    try {
      // await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should pack images from glob pattern', async () => {
    const outputPath = path.join(testOutputDir, 'test-pack-glob.charpack');
    const inputPattern = 'test/ignored/input/*.png';

    // Calculate input size before packing
    const inputSize = await calculateInputSize(inputPattern);

    // Pack images using glob pattern
    await charpack({
      input: inputPattern,
      output: outputPath,
      config: {
        withExtension: false,
      },
    });

    // Verify output file exists and calculate output size
    const outputStats = await fs.stat(outputPath);
    expect(outputStats.size).toBeGreaterThan(0);

    // Log statistics
    const compressionRatio = ((inputSize - outputStats.size) / inputSize * 100).toFixed(2);
    console.log(`Glob Result - Input Size: ${inputSize} bytes, Output Size: ${outputStats.size} bytes, Compression Ratio: ${compressionRatio}%`);
  }, 120 * 1000);
});
