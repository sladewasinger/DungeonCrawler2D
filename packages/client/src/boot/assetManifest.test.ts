import { describe, expect, it } from "vitest";
import { ASSET_PATHS, buildAssetPath } from "./assetManifest.js";
import { PET_ASSETS } from "./petAssetManifest.js";

describe("build-versioned public assets", () => {
  it("gives every shared asset a build-specific URL", () => {
    expect(Object.values(ASSET_PATHS).every(hasBuildVersion)).toBe(true);
  });

  it("versions pet sheets through the same path contract", () => {
    const paths = Object.values(PET_ASSETS).map((asset) => asset.path);
    expect(paths.every(hasBuildVersion)).toBe(true);
  });

  it("preserves existing query parameters", () => {
    expect(buildAssetPath("assets/example.json?variant=mobile"))
      .toBe("assets/example.json?variant=mobile&build=dev");
  });
});

function hasBuildVersion(path: string): boolean {
  return new URL(path, "https://assets.invalid").searchParams.has("build");
}
