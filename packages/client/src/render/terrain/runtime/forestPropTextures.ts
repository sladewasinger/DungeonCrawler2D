import type Phaser from "phaser";
import { TERRAIN_PROPS, type TerrainPropKind } from "../geometry/terrainPlannerModel.js";
import { ensureSafeHouseTexture } from "../material/safeHouseTexture.js";
import { ensureSpawnHouseTexture } from "../material/spawnHouseTexture.js";

const NEAREST_FILTER = 1 as Phaser.Textures.FilterMode;
const EMPTY_ROW = "................";

export const FOREST_TEXTURE_KEYS: Readonly<Record<
  Extract<TerrainPropKind, "water" | "bridge" | "tree" | "bush" | "boulder">,
  string
>> = {
  [TERRAIN_PROPS.Water]: "forest-water",
  [TERRAIN_PROPS.Bridge]: "forest-bridge",
  [TERRAIN_PROPS.Tree]: "forest-tree",
  [TERRAIN_PROPS.Bush]: "forest-bush",
  [TERRAIN_PROPS.Boulder]: "forest-boulder",
};

interface PixelSpriteSpec {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly palette: Readonly<Record<string, string>>;
  readonly rows: readonly string[];
}

const PALETTE: Readonly<Record<string, string>> = {
  a: "#102733", b: "#173a4c", c: "#1f5268", d: "#286b84", e: "#459ab0", f: "#72c7d4",
  g: "#3d2515", h: "#53341f", i: "#6e472b", j: "#8b5a36", k: "#a97246", l: "#b78658",
  m: "#183824", n: "#225232", o: "#2f7041", p: "#438f52", q: "#66b368", r: "#4de0c8",
  s: "#f5ba42", t: "#2a2d38", u: "#414656", v: "#5d6478", w: "#7c859c", x: "#152019",
};

const SPRITES: readonly PixelSpriteSpec[] = [
  {
    key: FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Water], width: 16, height: 16, palette: PALETTE,
    rows: [
      "aabbbbbccbbbbbaa", "abbbccccdcccbbba", "bcdeeecccdccbcbb", "bcccddcccccceffb",
      "bccbcddcccccddcb", "abcbccddccddccba", "bbccefeddcccccbb", "bcdcccddcccefdcb",
      "bccccccbbccddccb", "bcdeedcccccbbccb", "abcccccdeefcccba", "bccccddcccccccbb",
      "bccbcddcccddeecb", "bcccccccddccccbb", "abbbccdeffcccbaa", "aabbbccccccbbbaa",
    ],
  },
  {
    key: FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Bridge], width: 16, height: 16, palette: PALETTE,
    rows: [
      "ghgggggggggggggh", "gljjjjjjjjjjjjlg", "ghkkkkkkkkkkkkhg", "gljjjjjjkjjjjjlg",
      "gggggggggggggggg", "ghjjjjjkjjjjjjhg", "glkkkkkkkkkkkklg", "ghiiiijjjjjjjihg",
      "gggggggggggggggg", "gljjjjjkkkkjjjlg", "ghkkkkkkkkkkkkhg", "gljjjjiijjjjjjlg",
      "gggggggggggggggg", "ghkkkjjjjjjkkkhg", "gljjjjjjjkkkjjlg", "ghgggggggggggggh",
    ],
  },
  {
    key: FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Tree], width: 16, height: 28, palette: PALETTE,
    rows: [
      ".....mmmmmm.....", "...mmmnpppnmm...", "..mnopqqqqponm..", ".mnopqppqqqponm.",
      ".mnopppnnopppnm.", "mmopppnmmnopoomm", "mnopqqpoooppqonm", "mnppqqqqppqqqpnm",
      "mnnopqqppqqpponm", "mmnooppppppoonmm", "mnnooppooopponnm", ".mnnnooooooonnm.",
      ".mmnnooonnnoomm.", "..mmmnnnnnnnmm..", "...mmmmmmmmmm...", ".....mmggmm.....",
      "......ghhg......", "......gijg......", "......ghig......", ".....gghigg.....",
      ".....ghijhg.....", ".....ghijig.....", "....xghijhgx....", "...xxghijigxx...",
      "..xxxghjjigxxx..", "..xxgghjjiggxx..", "...xxggggggxx...", ".....xxxxxx.....",
    ],
  },
  {
    key: FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Bush], width: 16, height: 16, palette: PALETTE,
    rows: [
      ".....mmmmmm.....", "...mmnoppponm...", "..mnopqqqqponm..", ".mnopqrppqqsonm.",
      ".mnppqppopppponm", "mnopppnnnoopppnm", "mnnpoooppppqpnnm", "mnoopqrooppqponm",
      "mnnoppppoopsonmm", "mmnnnoopppoonnmm", ".mmnnnooooonnmm.", ".xxmmnnnnnnmmxx.",
      "..xxxmmmmmmxxx..", "...xxxxxxxxxx...", EMPTY_ROW, EMPTY_ROW,
    ],
  },
  {
    key: FOREST_TEXTURE_KEYS[TERRAIN_PROPS.Boulder], width: 16, height: 16, palette: PALETTE,
    rows: [
      ".....tttttt.....", "...ttuvvvvutt...", "..tuvwwwwvvnut..", ".tuvwwvvvuunnot.",
      ".tuvvvuuuvvnoot.", "tuvvuuuuuvvvvunt", "tuuvuuutuuuuvunt", "ttuuuuuttttuuutt",
      "ttuutttttttuuttt", ".tttttttttttttt.", ".xxttttttttttxx.", "..xxxxxxxxxxxx..",
      EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW,
    ],
  },
];

export function ensureForestPropTextures(scene: Phaser.Scene): void {
  ensureSafeHouseTexture(scene);
  ensureSpawnHouseTexture(scene);
  for (const spec of SPRITES) {
    if (scene.textures.exists(spec.key)) continue;
    buildCanvasTexture(scene, spec);
  }
}

function buildCanvasTexture(scene: Phaser.Scene, spec: PixelSpriteSpec): void {
  const texture = scene.textures.createCanvas(spec.key, spec.width, spec.height);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, spec.width, spec.height);
  paintPixelRows(ctx, spec);
  texture.refresh();
  texture.setFilter(NEAREST_FILTER);
}

function paintPixelRows(ctx: CanvasRenderingContext2D, spec: PixelSpriteSpec): void {
  spec.rows.forEach((row, y) => paintPixelRow({ ctx, palette: spec.palette, row, y }));
}

function paintPixelRow(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: Readonly<Record<string, string>>;
  readonly row: string;
  readonly y: number;
}): void {
  for (let x = 0; x < input.row.length; x++) {
    const code = input.row[x];
    const color = code ? input.palette[code] : undefined;
    if (!color) continue;
    input.ctx.fillStyle = color;
    input.ctx.fillRect(x, input.y, 1, 1);
  }
}
