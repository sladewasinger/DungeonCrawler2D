/** Procedural pixel-art luminance masks for splatters, blade arcs, goop, piles, and water clouds. */
import type { ChunkKind } from "./goreTextures.js";

export const SPLATTER_MASKS: readonly (readonly string[])[] = [
  [
    "...++.....o.",
    "..+oo+..+...",
    ".+o*ooo+oo+.",
    "+oo*oooooo+.",
    ".+ooooooo+..",
    "..+o*ooo+...",
    "..+o++++..o.",
  ],
  [
    ".++...+++...",
    ".o+..+o*o+o.",
    "...++ooooo+.",
    "..+ooo*ooo+.",
    "..+oooooo+..",
    "...+oo++o+..",
  ],
  [
    "....+o+...o.",
    ".oo..+.+oo+.",
    ".+.+ooo*ooo+",
    "....+o*ooo+.",
    "..+..+ooo+..",
    "..+o..++..+.",
  ],
  [
    "..+++.......",
    ".+o*o+..++..",
    "+oooo++oo+..",
    ".+ooo+o+..o.",
    "..+++...+...",
  ],
];

/** 6 organic, broken blade-slice spray shapes (convex spray along -Y, sweep along +X). */
export const ARC_MASKS: readonly (readonly string[])[] = [
  [
    ".....+++++...........",
    "..+++oo*oo+++..++....",
    ".+o*oooo+ooo++oo+..o.",
    "+o++...++o++...+o+...",
    ".........+..........o",
  ],
  [
    "....+++....+++.......",
    ".+ooo*o+..+ooo++..o..",
    "+oo*oo++...++oo++..+.",
    ".+++..........+o+....",
    "................+...o",
  ],
  [
    "......+++++..........",
    "...++oo*ooo++..++....",
    ".+oo*o++..++ooo+o+...",
    "+o++........++....o..",
    "..+oo+.....+o+.......",
  ],
  [
    "...+++........+......",
    ".+oo*oo+..+++..+o....",
    "+o*oooo+..ooo+...++..",
    "+oo++..+...++o++...o.",
    ".+...........++......",
  ],
  [
    "..+o+...++o+....++...",
    ".+oo*+..+oo+...oo+...",
    "+o+........++o+...+o.",
    "....++o+.....++......",
    "...+oo+..........+...",
  ],
  [
    "......+++++..o.......",
    "...++ooo*oo+++..++...",
    ".+ooo*ooo++ooo++oo+..",
    "+oo*o+++...++ooo++..o",
    "+o++...+o+....++.....",
    ".......++............",
  ],
];

export const STREAK_MASKS: readonly (readonly string[])[] = [
  ["..+oo+.......", ".+o*ooo++..o.", "+ooo+oooo+...", ".++....++..o."],
  ["...++........", "+oo*o++..++..", ".+oooo++..o..", "...++........"],
  ["..+o*+...++..", ".+oooo+..oo+.", "+o++..+...+.."],
];

export const GOOP_BLOB_MASKS: readonly (readonly string[])[] = [
  ["..++++++..", ".+oo**oo+.", "+oo*oooo+.", "+ooooooo#.", ".+oo###+..", "..++++++.."],
  ["...++++...", ".+oo**oo+.", "+oooo*ooo+", "+oo##oooo+", ".+######+."],
  [".+++++....", "+o*ooo+...", "ooooooo+..", "+ooo###+..", ".+####+..."],
];

export const GOOP_PUDDLE_MASKS: readonly (readonly string[])[] = [
  [
    ".....++++++++++.........",
    "..+++oooo**oooo++++.....",
    ".+ooo*ooooooooooooo++...",
    "+oooooooo*oooo**ooooo+..",
    "+ooooo+oooooooooooo*o#..",
    "+oooo#ooooooooooooooo#..",
    ".+#####oooo###ooooo##...",
    "...++++#######++++++....",
  ],
  [
    "...+++++++++++..........",
    ".++oooo**ooooo++++++....",
    "+ooo*oooooo**ooooooo+...",
    "+ooooooooooo+oooo*oo#...",
    "+oo##oooo*oooooooooo#...",
    ".+####ooooo#####ooo#....",
    "...+++++++++...++++.....",
  ],
];

export const POOL_MASKS: readonly (readonly string[])[] = [
  [
    "......++++++++++........",
    "...+++oooooooooo+++.....",
    ".++oooo**oooooooooo++...",
    "+oooo*ooo*ooooooooooo+..",
    "+oooooooooooooooooo*o#..",
    ".++ooooo*oooooooooo##...",
    "...++++++ooooo#####+....",
  ],
  [
    "...+++++++++............",
    ".++ooooooooo+++++.......",
    "+ooo*ooooooooooooo++....",
    "+ooooooo*oooo**ooooo+...",
    "+oooooooooo+ooooooo##...",
    "..++oooooooooooo####....",
    "....++++++oooo++++......",
  ],
];

export const CHUNK_MASKS: Readonly<Record<ChunkKind, readonly (readonly string[])[]>> = {
  soft: [["..++..", ".+o*+.", "+ooo*+", "+o++o+", ".+##+."], [".+++..", "+o*o+.", "oooo*+", ".+o##."]],
  bone: [["o+...+o", "+o***o+", "o+...+o"], ["..+o*+.", "+o*o++."], ["*o+....", ".+oo*+."]],
  stone: [[".+oo+.", "+*oo+#", "oo++##", ".+##+."], [".+++..", "+o*o#.", "+oo##."], ["+oo#.", "oo##."]],
  straw: [["..+o****+..", "+o++....+o+"], [".*oo++.+o*+", "+*o*o++..++"]],
};

export const BONE_PILE_MASK: readonly string[] = [
  "........++++..............",
  ".......+oooo+.............",
  "......+oo*o#o+...o+...+o..",
  "....oo+o###oo+..+oo***oo+.",
  "..+o***oooo+++..o+....+o..",
  ".+oo++oo*oo*ooo++.........",
  "+oo+..++oooo+o*ooo++..+o+.",
  ".++..+o****o++oo*ooo+*oo+.",
  "....+o+...++o++####++oo+..",
  ".....+.......++.....++....",
];

export const RUBBLE_PILE_MASK: readonly string[] = [
  "........+++++.............",
  ".......+oo*oo#............",
  "....++++oo++##++..........",
  "...+o*oo#++ooo*o#.........",
  "..+oooo##+oooo###++.......",
  ".++o*o##+oo*oo##+oo+......",
  "+ooo###+ooooo###+oo#..++..",
  "+o*o##++oo###oo#+##+.+o#..",
  ".+###++##++####+.++...++..",
  "..++..+oo#..++.....+o#....",
];

export const WATER_PLUME_MASKS: readonly (readonly string[])[] = [
  [
    "....1122211.......",
    "..11223332211.....",
    ".1223333333221....",
    "1223333333332211..",
    "12333333333222211.",
    ".122333332222111..",
    "..11222222111.....",
    "....1111111.......",
  ],
  [
    "..11122211........",
    ".122333322111.....",
    "12333333332221....",
    "123333333332211...",
    ".12233333322211...",
    "..11222332211.....",
    "....1112111.......",
  ],
];

export const FOOTPRINT_MASKS: readonly (readonly string[])[] = [
  [".+oo..", "+ooo..", "..++..", "......", "...+oo", "..+ooo"],
  ["...++.", "..+oo.", "..+oo.", "......", ".++...", "+ooo.."],
];

export const DROPLET_MASK: readonly string[] = [".+o.", "+o*+", "+oo+", ".++."];
export const SPARK_MASK: readonly string[] = ["+o***o+", ".+ooo+."];
export const GROUND_CRACK_MASK: readonly string[] = [
  "......#......o........",
  ".....#o#....#.........",
  "..#...o....#o....#....",
  "...#o.#o..#o....#o....",
  "....#oo*ooo*oo##......",
  ".##ooo*o#ooo#o*oo#....",
  "....#o...#o...#o..#...",
  "...#......#....o#.....",
  "..o.............#.....",
];
