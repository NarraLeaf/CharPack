const fs = require('fs/promises');
const path = require('path');
const { glob } = require('glob');
const { charpack } = require('../');

/**
 * Calculate total size of input files
 */
async function calculateInputSize(input) {
    let filePaths = [];

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

async function main() {
    const testOutputDir = path.join(__dirname, 'output');
    const time = Date.now();

    await fs.mkdir(testOutputDir, { recursive: true });

    const outputPath = path.join(testOutputDir, 'test-pack-glob.charpack');
    const inputPattern = 'test/ignored/input/*.png';

    // Calculate input size before packing
    const inputSize = await calculateInputSize(inputPattern);

    // Pack images using glob pattern
    await charpack({
        input: inputPattern,
        output: outputPath,
        config: {
            blockSize: 8,                    // Smaller blocks for better precision
            colorDistanceThreshold: 16,        // Tolerate slight color differences (sharpening artifacts)
            diffToleranceRatio: 0.05,         // Allow 5% of pixels in a block to be different (handle scattered noise)
        },
    });

    // Verify output file exists and calculate output size
    const outputStats = await fs.stat(outputPath);

    // Log statistics
    const compressionRatio = ((inputSize - outputStats.size) / inputSize * 100).toFixed(2);
    console.log(`Glob Result - Input Size: ${inputSize} bytes, Output Size: ${outputStats.size} bytes, Compression Ratio: ${compressionRatio}%`);
    console.log(`Time taken: ${(Date.now() - time) / 1000}s`);
}

main();