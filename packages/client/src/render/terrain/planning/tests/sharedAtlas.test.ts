import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  TERRAIN_TILESETS,
  terrainAtlasFrame,
  terrainFrameFor,
} from "../tileset.js";

const ATLAS_PATH = resolve(process.cwd(), "packages/client/public/assets/terrain/shared-atlas.png");
const PRE_VARIANT_SHA256 = "745ba754f26d0c29d67a0f4ba63e4bebf4d4e8170e0e2c684e0b9c374de14074";

describe("finite territory atlas variants", () => {
  it("keeps the shared atlas dimensions and replaces the pre-variant bitmap", () => {
    const bitmap = readFileSync(ATLAS_PATH);
    expect(bitmap.readUInt32BE(16)).toBe(576);
    expect(bitmap.readUInt32BE(20)).toBe(320);
    expect(createHash("sha256").update(bitmap).digest("hex")).not.toBe(PRE_VARIANT_SHA256);
  });

  it("keeps three matching floor and wall frame pairs in the atlas", () => {
    const atlas = TERRAIN_TILESETS["maze"];
    const pairs = [
      ["territory-goblin-floor", "territory-goblin-wall"],
      ["territory-spider-floor", "territory-spider-wall"],
      ["territory-gaol-floor", "territory-gaol-wall"],
    ] as const;
    for (const [floor, wall] of pairs) {
      const floorFrame = terrainAtlasFrame({ set: atlas, role: floor, variant: 0, image: { width: 576, height: 320 } });
      const wallFrame = terrainAtlasFrame({ set: atlas, role: wall, variant: 0, image: { width: 576, height: 320 } });
      expect(floorFrame.width).toBe(64);
      expect(wallFrame.width).toBe(64);
      expect(floorFrame.x).toBe(wallFrame.x);
      expect(terrainFrameFor(floor, 0)).not.toBe(terrainFrameFor(wall, 0));
    }
  });

  it("maps structural bedrock to authored dark art, not the gray raised cap", () => {
    const atlas = decodeAtlas(readFileSync(ATLAS_PATH));
    const raised = atlas.pixel(2 * 64 + 32, 32);
    const bedrock = atlas.pixel(3 * 64 + 32, 32);
    const bedrockFrame = terrainAtlasFrame({
      set: TERRAIN_TILESETS.maze, role: "bedrock", variant: 0, image: atlas,
    });
    const raisedFrame = terrainAtlasFrame({
      set: TERRAIN_TILESETS.maze, role: "raised-floor", variant: 0, image: atlas,
    });

    expect(bedrockFrame.x).toBe(3 * 64);
    expect(raisedFrame.x).toBe(2 * 64);
    expect(bedrock[0]).toBeLessThan(raised[0]);
    expect(bedrock[2]).toBeLessThan(raised[2]);
  });
});

interface AtlasPixels {
  readonly width: number;
  readonly height: number;
  readonly pixel: (x: number, y: number) => readonly [number, number, number, number];
}

function decodeAtlas(bitmap: Buffer): AtlasPixels {
  const png = readPng(bitmap);
  const pixels = unfilterRgba(inflateSync(Buffer.concat(png.chunks)), png.width, png.height);
  return { width: png.width, height: png.height, pixel: (x, y) => pixelAt({ pixels, width: png.width, x, y }) };
}

interface PngData {
  readonly width: number;
  readonly height: number;
  readonly chunks: readonly Buffer[];
}

function readPng(bitmap: Buffer): PngData {
  const chunks: Buffer[] = [];
  let offset = 8;
  let width = 0;
  let height = 0;
  while (offset < bitmap.length) {
    const size = bitmap.readUInt32BE(offset);
    const type = bitmap.toString("ascii", offset + 4, offset + 8);
    const data = bitmap.subarray(offset + 8, offset + 8 + size);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === "IDAT") chunks.push(data);
    offset += size + 12;
  }
  return { width, height, chunks };
}

function unfilterRgba(raw: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4;
  const pixels = new Uint8Array(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++]!;
    const rowStart = y * stride;
    const row = unfilterRow({ raw, pixels, source, filter, rowStart, stride, hasAbove: y > 0 });
    pixels.set(row, rowStart);
    source += stride;
  }
  return pixels;
}

interface FilterRowInput {
  readonly raw: Uint8Array;
  readonly pixels: Uint8Array;
  readonly source: number;
  readonly filter: number;
  readonly rowStart: number;
  readonly stride: number;
  readonly hasAbove: boolean;
}

function unfilterRow(input: FilterRowInput): Uint8Array {
  const row = new Uint8Array(input.stride);
  for (let x = 0; x < input.stride; x += 1) {
    row[x] = unfilteredByte({ ...input, row, x });
  }
  return row;
}

function unfilteredByte(input: FilterRowInput & { readonly row: Uint8Array; readonly x: number }): number {
  const { row, x, pixels, rowStart, stride, hasAbove, raw, source, filter } = input;
  const left = x >= 4 ? row[x - 4]! : 0;
  const above = hasAbove ? pixels[rowStart - stride + x]! : 0;
  const upperLeft = hasAbove && x >= 4 ? pixels[rowStart - stride + x - 4]! : 0;
  return (raw[source + x]! + filterDelta({ filter, left, above, upperLeft })) & 255;
}

interface FilterInput {
  readonly filter: number;
  readonly left: number;
  readonly above: number;
  readonly upperLeft: number;
}

function filterDelta(input: FilterInput): number {
  if (input.filter === 1) return input.left;
  if (input.filter === 2) return input.above;
  if (input.filter === 3) return Math.floor((input.left + input.above) / 2);
  if (input.filter === 4) return paeth(input.left, input.above, input.upperLeft);
  return 0;
}

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function pixelAt(input: {
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}): readonly [number, number, number, number] {
  const offset = (input.y * input.width + input.x) * 4;
  return [input.pixels[offset]!, input.pixels[offset + 1]!, input.pixels[offset + 2]!, input.pixels[offset + 3]!];
}
