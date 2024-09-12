declare module 'pixelmatch' {
    interface PixelmatchOptions {
        threshold?: number; // Threshold for matching, ranges from 0 to 1 (default: 0.1)
        includeAA?: boolean; // Whether to include anti-aliased pixels (default: false)
        alpha?: number; // Blending factor for unchanged pixels (default: 0.1)
        aaColor?: [number, number, number]; // Color of anti-aliased pixels (default: [255, 255, 0])
        diffColor?: [number, number, number]; // Color of differing pixels (default: [255, 0, 0])
        diffColorAlt?: [number, number, number]; // Optional: Color of darker differing pixels
    }

    function pixelmatch(
        img1: Buffer | Uint8Array, // Image data of the first image
        img2: Buffer | Uint8Array, // Image data of the second image
        output: Buffer | Uint8Array | null, // Output array or null
        width: number, // Image width
        height: number, // Image height
        options?: PixelmatchOptions // Optional comparison settings
    ): number; // Returns the number of differing pixels

    export = pixelmatch;
}