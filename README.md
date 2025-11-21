# CharPack

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
        blockSize: 8,                    // Smaller blocks for better precision
        colorDistanceThreshold: 8,        // Tolerate slight color differences (sharpening artifacts)
        diffToleranceRatio: 0.05,         // Allow 5% of pixels in a block to be different (handle scattered noise)
    },
});
```

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

> **Note:**
> 
> The output directory will be created if it does not exist.

To unpack a single variation from a character pack into an individual image:

```ts
unpack(
    "./input.charpack", // Input Package
    "./output/smile.png", // Output File
    "smile", // Variation Name
);
```

To unpack multiple variations from a character pack into individual images: 

```ts
unpack(
    "./input.charpack", // Input Package
    {
        "smile": "./output/smile.png",
        "angry": "./output/angry.png",
        "sad": "./output/sad.png",
    }
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

## Browser Environment

To use CharPack in a browser environment for reading character pack files, you can use the `@narraleaf/charpack/browser` package.

For more details, see [Browser Environment](./docs/browser.md)
