/**
 * Node.js Example - CharPack Usage
 */

const { charpack, unpack, extract, read } = require('@narraleaf/charpack');

async function main() {
  // Example 1: Pack images from a glob pattern
  await charpack({
    input: './images/*.png',
    output: './output/character.charpack',
    config: {
      withExtension: false, // Use filename without extension as variation name
    },
  });
  console.log('✓ Packed images from glob pattern');

  // Example 2: Pack specific images with custom names
  await charpack({
    input: {
      smile: './images/smile.png',
      angry: './images/angry.png',
      sad: './images/sad.png',
    },
    output: './output/emotions.charpack',
  });
  console.log('✓ Packed images with custom names');

  // Example 3: Unpack all variations to directory
  await unpack('./output/character.charpack', './output/unpacked');
  console.log('✓ Unpacked all variations');

  // Example 4: Unpack single variation
  await unpack('./output/character.charpack', './output/smile.png', 'smile');
  console.log('✓ Unpacked single variation');

  // Example 5: Extract and convert to different formats
  const image = await extract('./output/character.charpack', 'smile');
  const pngBuffer = await image.png();
  const jpegBuffer = await image.jpeg();
  const webpBuffer = await image.webp();
  const base64String = await image.base64();
  console.log('✓ Extracted and converted to multiple formats');

  // Example 6: Read multiple variations efficiently
  const pack = await read('./output/character.charpack');
  const smile = await pack.png('smile');
  const angry = await pack.png('angry');
  const sad = await pack.png('sad');
  pack.dispose(); // Clean up memory
  console.log('✓ Read multiple variations efficiently');
}

main().catch(console.error);

