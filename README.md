# CharPack

[![npm version](https://badge.fury.io/js/%40narraleaf%2Fcharpack.svg)](https://badge.fury.io/js/%40narraleaf%2Fcharpack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## Introduction

CharPack is an image compression tool optimized for character illustrations. It **doesn't compress individual images, but it removes 
duplicate parts from character variations** and generates an image package.

The advantage of this is that it can immediately and significantly reduce the overall size of multiple character sub-images. Image 
loading relies on runtime calculations.

## @NarraLeaf/CharPack

### Installation

```bash
npm install @narraleaf/charpack
```

## Usage

For documentation, see [Documentation](./docs/documentation.md)

### Pack

To pack all images in the input directory into a single package and save it to the output directory: 

```ts
import { charpack } from '@narraleaf/charpack';

await charpack({
    input: "./input/images/*",   // Input directory (glob)
    output: "./output.charpack", // Output package
    config: {
        blockSize: 8,              // Smaller blocks for better precision
        colorDistanceThreshold: 8, // Tolerate slight color differences (sharpening artifacts)
        diffToleranceRatio: 0.05,  // Allow 5% of pixels in a block to be different (handle scattered noise)
    },
});
```

`blockSize` should be between 4 and 128. The smaller the block size, the more precise the compression, but
longer the compression time. In most cases, 8 is a good compromise between precision and speed.

`colorDistanceThreshold` should be between 0 and 441.7. The larger the threshold, the more pixels are considered identical. If image integrity is not a primary concern, a value of 8-16 is recommended. This option defaults to 0 (for strict comparison).

`diffToleranceRatio` should be between 0 and 1. The larger the ratio, the more chunks are considered identical. If image integrity is not a primary concern, a value of 0.05-0.1 is recommended. This option defaults to 0 (for strict comparison).

> **Note:**
> 
> A `.charpack` file contains all the variations of a single character.  
> If variation names are not specified, they will default to the base file name (without extension by default).

To pack specific images in the input directory into a single package and save it to the output directory:

```ts
await charpack({
    input: ["image1.png", "image2.png", /* ... */], // Specific images to pack
    output: "./output.charpack",                   // Output package
});
```

To specify variation names for the single character:

```ts
await charpack({
    input: {
        normal: "normal.png",
        happy: "happy.png",
        angry: "angry.png",
    },
    output: "./output.charpack", // Output package
});
```

IMPORTANT: The compression ratio of the image packs is determined by the degree of image repetition. Images with high repetition (e.g., subtle differences in facial expressions) yield better compression. Images with low repetition (e.g., different outfits) will have slightly lower compression rates.

A recommended approach is to generate a separate pack for each outfit of the character. For example, `pajamas.charpack`, `dresses.charpack`, `formal.charpack`. Within each pack, use the character variant as the name, such as `smile`, `angry`, `sad`.

### Unpack

To unpack a character pack into individual images:

```ts
import { unpack } from '@narraleaf/charpack';

unpack(
    "./input.charpack", // Input Package
    "./output", // Output Directory
);
```

### Read

To read a character variation from a character pack:

```ts
import { extract } from '@narraleaf/charpack';

const image = await extract(
    "./input.charpack", // Input Package
    "smile", // Variation Name
).png(); // Returns a Buffer
```

To read multiple variations: 

```ts
import { read } from '@narraleaf/charpack';

const pack = await read(
    "./input.charpack", // Input Package
);

const smileImage = await pack.png("smile"); // Returns a Buffer
const angryImage = await pack.png("angry");
const sadImage = await pack.png("sad");

pack.dispose(); // Free the memory
```

For more details for CharPack Node.js API, see [Documentation](./docs/documentation.md)

## Browser Environment

To use CharPack in a browser environment for reading character pack files, you can use the `@narraleaf/charpack/browser` package.

For more details, see [Browser Environment](./docs/browser.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
