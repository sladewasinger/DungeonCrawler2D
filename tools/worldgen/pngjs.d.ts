// Minimal ambient typing for the subset of pngjs this tool uses — pngjs
// ships no types and tools/ has no @types/pngjs dependency of its own.

declare module "pngjs" {
  export class PNG {
    constructor(options: { width: number; height: number });
    readonly width: number;
    readonly height: number;
    data: Buffer;
    static sync: {
      write(png: PNG): Buffer;
    };
  }
}
