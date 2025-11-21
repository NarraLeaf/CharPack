/**
 * Example: Visualize compressed regions in CharPack files
 * This example demonstrates how to use the visualizeCompression function
 * to see which parts of images are actually compressed/stored as diffs.
 */

const { charpack, visualizeCompression, visualizeVariationPatchesFromData, deserialize } = require('../dist/index.js');
const fs = require('fs/promises');
const path = require('path');

async function main() {
  try {
    console.log('CharPack compression visualization example');

    // Create example input files (if they don't exist)
    const inputDir = path.join(__dirname, '..', 'test', 'ignored', 'input');
    const outputDir = path.join(__dirname, '..', 'test', 'output');
    const visualizationsDir = path.join(outputDir, 'visualizations');
    const charpackPath = path.join(outputDir, 'visualization-example.charpack');

    // Ensure directories exist
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(visualizationsDir, { recursive: true });

    // Create CharPack file (using test images)
    console.log('Creating CharPack file...');
    await charpack({
      input: "test/ignored/input/*.png",
      output: charpackPath,
      config: {
        blockSize: 8,                    // Smaller blocks for better precision
        colorDistanceThreshold: 16,        // Tolerate slight color differences (sharpening artifacts)
        diffToleranceRatio: 0.1,         // Allow 5% of pixels in a block to be different (handle scattered noise)
      },
    });
    console.log(`CharPack file created: ${charpackPath}`);

    // Generate compression visualizations for all variations
    console.log('Generating compression visualizations...');
    await generateAllVisualizations(charpackPath, visualizationsDir);

    // Display statistics
    const stats = await fs.stat(charpackPath);
    console.log(`CharPack file size: ${stats.size} bytes`);

    console.log('\nVisualization explanation:');
    console.log('- Blue areas: compressed duplicate parts (shared across all variants)');
    console.log('- Non-blue areas: parts that differ between variants (stored as diff patches)');
    console.log('- Red areas: patches for specific variations');
    console.log('- More blue areas indicate better compression efficiency');

  } catch (error) {
    console.error('An error occurred:', error.message);
    process.exit(1);
  }
}

/**
 * Generate visualizations for all variations and overall compression
 */
async function generateAllVisualizations(charpackPath, outputDir) {
  // Read the CharPack data to get variation information
  const buffer = await fs.readFile(charpackPath);
  const charPackData = deserialize(buffer);

  console.log(`Found ${charPackData.variations.length} variations:`);

  // Generate overall compression visualization (all compressed regions)
  const overallVisualization = await visualizeCompression(charpackPath);
  const overallPath = path.join(outputDir, 'overall-compression.png');
  await fs.writeFile(overallPath, await overallVisualization.png());
  console.log(`- Overall compression: ${overallPath}`);

  // Generate individual variation visualizations
  for (const variation of charPackData.variations) {
    const variationVisualization = await visualizeVariationPatchesFromData(charPackData, variation.name);
    const variationPath = path.join(outputDir, `variation-${variation.name}.png`);
    await fs.writeFile(variationPath, await variationVisualization.png());
    console.log(`- Variation '${variation.name}': ${variationPath} (${variation.patches.length} patches)`);
  }
}

// Run example
if (require.main === module) {
  main();
}

module.exports = { main };
