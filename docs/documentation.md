# Documentation

## Packing Syntax

A `.charpack` file represents variations of a single character.

```ts
// Object form: assign custom variation names
charpack({
  normal: "normal.png",
  happy: "happy.png",
  angry: "angry.png",
}, "./output.charpack");

// Array form: variation name defaults to file name with extension
charpack([
  "normal.png",
  "happy.png",
  "angry.png",
], "./output.charpack", {
  withExtension: false,
});
```

The `PackConfig` is an optional object that can be used to configure the packing process:  
```ts
type PackConfig = {
  /**
   * Whether to include the extension in the variation name.
   * @default true
   */
  withExtension?: boolean;
  /**
   * A function to customize the variation name.
   * @default (filePath) => path.basename(filePath, path.extname(filePath))
   */
  variationName?: (filePath: string) => string;
};
```

> **Note:**
>
> `charpack` will throw an error if:
> - Invalid input
> - Unsupported file format
> - Any other error that occurs during the packing process, such as file system errors, etc.

### charpack(options: { input: string | string[] | Record<string,string>; output?: string; config?: PackConfig }): Promise<void>

Packs multiple character variation images into a single compressed `.charpack` file by identifying and removing duplicate image data across variations. This function supports various input formats including glob patterns, file arrays, and named objects, and provides configuration options for customizing the packing process.

- `input`: Specifies the source images to pack. Can be a glob pattern string, an array of file paths, or an object mapping variation names to file paths.
- `output`: Optional path where the resulting `.charpack` file will be saved.
- `config`: Optional configuration object to customize the packing behavior, including variation naming and extension handling.

```ts
await charpack({
  input: {
    smile: "smile.png",
    angry: "angry.png",
    sad: "sad.png",
  },
  output: "./output.charpack",
  config: { withExtension: false },
});
```

## Unpacking Syntax

To unpack a character pack into individual images:

```ts
unpack(
    "./input.charpack", // Input Package
    "./output", // Output Directory
);
```

The output directory will be created if it does not exist.

> **Note:**
> 
> `unpack` will throw an error if:
> - Invalid input
> - Variation name is not found in the character pack
> - Any other error that occurs during the unpacking process, such as file system errors, etc.

### unpack(input: string, output: string): Promise<void>

This will unpack a character pack into individual images and save them to the output directory.

```ts
import { unpack } from '@narraleaf/charpack';

unpack(
    "./input.charpack", // Input Package
    "./output", // Output Directory
);
```

The output directory will be created if it does not exist.

### unpack(input: string, output: string, variation: string): Promise<void>

This will unpack a single variation from a character pack into an individual image and save it to the output file.

```ts
import { unpack } from '@narraleaf/charpack';

unpack(
    "./input.charpack", // Input Package
    "./output/smile.png", // Output File
    "smile", // Variation Name
);
```

### unpack(input: string, output: Record<string, string>): Promise<void>

This will unpack multiple variations from a character pack into individual images and save them to the output files. The key of the object is the variation name and the value is the output file path.

```ts
import { unpack } from '@narraleaf/charpack';

unpack(
    "./input.charpack", // Input Package
    {
        "smile": "./output/smile.png", // will save the variation "smile" to "./output/smile.png"
        "angry": "./output/angry.png",
        "sad": "./output/sad.png",
    }
);
```

## Read Syntax

### extract(input: string, variation: string): CharPack

To read a character variation from a character pack:

```ts
import { extract } from '@narraleaf/charpack';

const image = await extract(
    "./input.charpack", // Input Package
    "smile", // Variation Name
).png(); // Returns a Buffer
```

This returns a `CharPack` object that can be used to get the image.

```ts
interface CharPack {
  png(): Promise<Buffer>;
  jpeg(): Promise<Buffer>;
  webp(): Promise<Buffer>;
  base64(): Promise<string>;
}
```

### read(input: string): Promise<MemoryCharPack>

This method will read the entire character pack into memory and return a `MemoryCharPack` object that can be used to get the images.

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

It is helpful to read multiple variations without reading the pack multiple times.

```ts
interface MemoryCharPack {
    png(variation: string): Promise<Buffer>;
    jpeg(variation: string): Promise<Buffer>;
    webp(variation: string): Promise<Buffer>;
    base64(variation: string): Promise<string>;
    dispose(): void;
    refresh(): void;
}
```

`refresh()` can be called to refresh the memory cache of the character pack. This is useful if the character pack has been modified since the last read.
