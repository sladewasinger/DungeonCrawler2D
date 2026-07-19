// CLI argument parsing for render-map: positional seed/floor/chunks/outPng.

export interface CliArgs {
  worldSeed: number;
  floor: number;
  chunks: number;
  outPng: string;
}

const USAGE = "usage: npx tsx tools/worldgen/render-map.ts <seed> <floor> <chunksNxN> <outPng>";

export function parseArgs(argv: string[]): CliArgs {
  const [seedStr, floorStr, chunksStr, outPng] = argv;
  if (!seedStr || !floorStr || !chunksStr || !outPng) throw new Error(USAGE);

  const worldSeed = Number(seedStr);
  const floor = Number(floorStr);
  const chunks = Number(chunksStr);
  if (!Number.isFinite(worldSeed) || !Number.isFinite(floor) || !Number.isInteger(chunks)) {
    throw new Error(USAGE);
  }
  return { worldSeed, floor, chunks, outPng };
}
