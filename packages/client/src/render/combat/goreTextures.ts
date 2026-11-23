/** Cached nearest-neighbor HD-pixel gore textures (splatters, streaks, gibs, pools, prints). */
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../textures/pixelCanvas.js";

export type ChunkKind = "soft" | "bone" | "stone" | "straw";

export interface GoreTextureSet {
  readonly splatters: readonly Texture[];
  readonly streaks: readonly Texture[];
  readonly chunks: Readonly<Record<ChunkKind, readonly Texture[]>>;
  readonly pools: readonly Texture[];
  readonly footprints: readonly Texture[];
  readonly waterPlume: Texture;
  readonly droplet: Texture;
}

const SHADE_BY_GLYPH: Readonly<Record<string, string>> = {
  "#": "#7c7c7c",
  "+": "#b2b2b2",
  o: "#dedede",
  "*": "#ffffff",
};

function maskToTexture(rows: readonly string[]): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const h = rows.length;
  const w = rows[0]?.length ?? 1;
  const { canvas, ctx } = createPixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const shade = SHADE_BY_GLYPH[row[x]!];
      if (!shade) continue;
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvasToNearestTexture(canvas);
}

const R16 = "................";

const SPLATTER_MASKS: readonly (readonly string[])[] = [
  [
    "....++..........",
    "...+oo+......o..",
    "....+#oo++..++..",
    "..+ooo*oooo+....",
    ".+o*ooooo*oo+...",
    "+oo*oooooo*o+...",
    ".+oooooooo+...++",
    "..+o*oooo+....o.",
    "..+o+++++...++..",
    ".++....+oo+.....",
    ".o.....++++.....",
    R16,
  ],
  [
    "..++............",
    "..o+...+++......",
    "......+ooo+..+o.",
    "..++.+o*ooo+.++.",
    "..oo+oo*oooo+...",
    "...++oooooooo+..",
    "..+oo*oooo*o+...",
    "...+oooo+oo++...",
    "....++++.+oo+...",
    ".++......+++....",
    ".+o..........++.",
    R16,
  ],
  [
    ".....+o+........",
    "..+..+++....+...",
    ".oo......+ooo+..",
    ".++..+++oo*ooo+.",
    "....+oo*oooooo+.",
    "..+oooo*ooooo+..",
    "...+oooooooo+...",
    "....++oo*o++..+o",
    "..+o..++++....++",
    "..++....++......",
    "........+o+.....",
    R16,
  ],
];

const STREAK_MASKS: readonly (readonly string[])[] = [
  [
    "..+ooo+.................",
    ".+o*oooo+++++...........",
    "+oo*oooooooooo+++..++...",
    ".+oooooo*ooooooo++.oo.+.",
    "..+ooo++..+++++.........",
  ],
  [
    "....+++.................",
    "..+oooo++++++...........",
    ".+oo*ooooooooo+++.......",
    "+o*oooooo+ooooo++..++.+.",
    ".+oooo+++...++.....oo...",
    "..++++..................",
  ],
];

const CHUNK_MASKS: Readonly<Record<ChunkKind, readonly (readonly string[])[]>> = {
  soft: [
    ["..++..", ".+o*+.", "+ooo*+", "+o++o+", ".+##+."],
    [".+++..", "+o*o+.", "oooo*+", ".+o##."],
  ],
  bone: [
    ["o+....+o", "+o****o+", "o+....+o"],
    ["..++o*+.", "+o*o++..", ".++....."],
  ],
  stone: [
    [".+oo+.", "+*oo+#", "oo++##", ".+##+."],
    [".+++..", "+o*o#.", "+oo##."],
  ],
  straw: [
    ["..+o****+..", "+o++....+o+"],
    [".*oo++.+o*+", "+*o*o++..++"],
  ],
};

const POOL_MASKS: readonly (readonly string[])[] = [
  [
    ".......++++++++++.......",
    "....+++oooooooooo+++....",
    "..++oooo**oooooooooo++..",
    ".+oooo*ooo*ooooooooooo+.",
    "+oooooooooooooooooooo*o+",
    "+ooooo+ooooooooooooooo#+",
    ".++oooooo*oooooooooo++..",
    "...+++++oooooo++++++....",
    "........++++++..........",
  ],
  [
    "....+++++++++...........",
    "..++ooooooooo+++++......",
    ".+ooo*ooooooooooooo++...",
    "+oooooooo*oooo**ooooo++.",
    "+ooooooo*ooooooooooooo#+",
    ".+oooooooooooooooooo++..",
    "...++++oooooooo+++++....",
    "......++++++++++........",
  ],
];

const FOOTPRINT_MASKS: readonly (readonly string[])[] = [
  [".+oo..", "+ooo..", "..++..", "......", "...+oo", "..+ooo"],
  ["...++.", "..+oo.", "..+oo.", "......", ".++...", "+ooo.."],
];

const PLUME_MASK: readonly string[] = [
  "....++++....",
  "..++oooo++..",
  ".+oo....oo+.",
  "+o..+oo+..o+",
  "+o..oooo..o+",
  ".+oo....oo+.",
  "..++oooo++..",
  "....++++....",
];

const DROPLET_MASK: readonly string[] = [".+o.", "+o*+", "+oo+", ".++."];

let cachedSet: GoreTextureSet | null = null;

export function getGoreTextures(): GoreTextureSet {
  if (cachedSet) return cachedSet;
  cachedSet = {
    splatters: SPLATTER_MASKS.map(maskToTexture),
    streaks: STREAK_MASKS.map(maskToTexture),
    chunks: {
      soft: CHUNK_MASKS.soft.map(maskToTexture),
      bone: CHUNK_MASKS.bone.map(maskToTexture),
      stone: CHUNK_MASKS.stone.map(maskToTexture),
      straw: CHUNK_MASKS.straw.map(maskToTexture),
    },
    pools: POOL_MASKS.map(maskToTexture),
    footprints: FOOTPRINT_MASKS.map(maskToTexture),
    waterPlume: maskToTexture(PLUME_MASK),
    droplet: maskToTexture(DROPLET_MASK),
  };
  return cachedSet;
}
