declare module "pngjs" {
  export const PNG: {
    sync: {
      read(
        buffer: Buffer,
      ): {
        data: Uint8Array;
        width: number;
        height: number;
      };
    };
  };
}
