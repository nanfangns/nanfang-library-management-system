declare module "gifenc" {
  export type GifPalette = number[][];

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
  ): Uint8Array;

  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: {
        delay?: number;
        palette?: GifPalette;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytesView(): Uint8Array;
  };
}
