declare module "three";

declare module "three/examples/jsm/loaders/FBXLoader.js" {
  export class FBXLoader {
    load(url: string, onLoad: (model: unknown) => void, onProgress?: undefined, onError?: (error: unknown) => void): void;
  }
}
