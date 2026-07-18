// CLI argument parsing for render-map: positional seed/floor/chunks/outPng plus --variant.

export interface CliArgs {
  worldSeed: number;
  floor: number;
  chunks: number;
  outPng: string;
  variant?: string;
}

const USAGE =
  "usage: npx tsx tools/worldgen/render-map.ts <seed> <floor> <chunksNxN> <outPng> [--variant name]";

function splitPositionalAndVariant(argv: string[]): { positional: string[]; variant?: string } {
  const positional: string[] = [];
  let variant: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--variant") {
      variant = argv[i + 1];
      i++;
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }

  return variant === undefined ? { positional } : { positional, variant };
}

function parsePositional(positional: string[]): { worldSeed: number; floor: number; chunks: number; outPng: string } {
  const [seedStr, floorStr, chunksStr, outPng] = positional;
  if (!seedStr || !floorStr || !chunksStr || !outPng) throw new Error(USAGE);

  const worldSeed = Number(seedStr);
  const floor = Number(floorStr);
  const chunks = Number(chunksStr);
  if (!Number.isFinite(worldSeed) || !Number.isFinite(floor) || !Number.isInteger(chunks)) {
    throw new Error(USAGE);
  }
  return { worldSeed, floor, chunks, outPng };
}

export function parseArgs(argv: string[]): CliArgs {
  const { positional, variant } = splitPositionalAndVariant(argv);
  const parsed = parsePositional(positional);
  return variant === undefined ? parsed : { ...parsed, variant };
}
