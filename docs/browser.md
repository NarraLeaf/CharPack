# Browser Environment

CharPack is also designed to be used in a browser environment for reading character pack files.

To use CharPack in a browser environment, you can use the `@narraleaf/charpack/browser` package.

## Unpacking Syntax

### unpack(input: Buffer, callback: (images: Record<string, Buffer>) => void): void

This will unpack the given character pack into individual images and return the images as a record of variation names and image buffers.

```ts
import { unpack } from '@narraleaf/charpack/browser';

unpack(
    buffer, // The buffer that represents the `.charpack` file
    (images) => {
        const variations = Object.keys(images);
        for (const variation of variations) {
            const image = images[variation];
            // Your Implementation to save the image
        }
    }
);
```

### unpack(input: Buffer, variations: string[], callback: (images: Record<string, Buffer>) => void): void

This will unpack the given character pack and return the images for the given variations.

```ts
import { unpack } from '@narraleaf/charpack/browser';

unpack(
    buffer, // The buffer that represents the `.charpack` file
    ["smile", "angry", "sad"], // The variations to unpack
    (images) => {
        // This will only contain the images for the given variations
    }
);
```

## Read Syntax

### extract(input: Buffer, variation: string): CharPack

This will extract the given variation from the character pack and return the image buffer.

```ts
import { extract } from '@narraleaf/charpack/browser';

const image = await extract(buffer, "smile").png(); // Returns a Buffer
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

### read(input: Buffer): Promise<MemoryCharPack>

This will read the given character pack into memory and return a `MemoryCharPack` object that can be used to get the images.

```ts
import { read } from '@narraleaf/charpack/browser';

const pack = await read(buffer); // The buffer that represents the `.charpack` file

const smileImage = await pack.png("smile"); // Returns a Buffer
const angryImage = await pack.png("angry");
const sadImage = await pack.png("sad");

pack.dispose(); // Unlink the buffer reference
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

The method `refresh()` will do nothing in the browser environment.
