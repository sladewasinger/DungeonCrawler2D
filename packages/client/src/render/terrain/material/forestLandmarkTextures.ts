/** Procedural pixel-art sprites for Bandit Camp tents, palisade fences, and Ancient Ruin pillars. */
import type Phaser from "phaser";

export const CAMP_TENT_TEXTURE_KEY = "forest-camp-tent";
export const CAMP_FENCE_TEXTURE_KEY = "forest-camp-fence";
export const RUIN_PILLAR_TEXTURE_KEY = "forest-ruin-pillar";

const NEAREST_FILTER = 1 as Phaser.Textures.FilterMode;

interface LandmarkSpriteSpec {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly palette: Readonly<Record<string, string>>;
  readonly rows: readonly string[];
}

const LANDMARK_PALETTE: Readonly<Record<string, string>> = {
  k: "#141018",
  // Wood & palisade
  w: "#3b2213", x: "#54321c", y: "#734729", z: "#915d38", r: "#b07b4f",
  // Canvas tent
  c: "#6b553b", d: "#8c7250", e: "#b0936a", f: "#cfb488", g: "#261c17",
  // Mossy stone pillar
  s: "#373c48", t: "#4e5566", u: "#6b7488", v: "#8e98ad",
  m: "#225232", n: "#387a47", o: "#5aa35b",
};

const LANDMARK_SPRITES: readonly LandmarkSpriteSpec[] = [
  {
    key: CAMP_TENT_TEXTURE_KEY,
    width: 16,
    height: 18,
    palette: LANDMARK_PALETTE,
    rows: [
      ".......kk.......",
      "......kzzk......",
      ".....kzeefk.....",
      "....kzeefdfk....",
      "...kzedeeddfk...",
      "..kzeeeedddddk..",
      "..kzeedggddedk..",
      ".kzeeeggkgddedk.",
      ".kzeedgkkggdedk.",
      "kzeeddgkkkggdddk",
      "kzedddgkkkggdddk",
      "kddddggkkkggddck",
      "kdddggkkkkkggcck",
      "kddcgkkkkkkkccck",
      "kccckkkkkkkkccwk",
      "kccwk......kwcck",
      "kwwk........kwwk",
      "kkkk........kkkk",
    ],
  },
  {
    key: CAMP_FENCE_TEXTURE_KEY,
    width: 16,
    height: 18,
    palette: LANDMARK_PALETTE,
    rows: [
      "..kk...kk...kk..",
      ".kyzk.kyzk.kyzk.",
      ".kyxk.kyxk.kyxk.",
      "kzyxkkzyxkkzyxkk",
      "kzyxkkyyxkkyyxkk",
      "kwwwwwwwwwwwwwwk",
      "krrzrrrrrrrrzrrk",
      "kwwwwwwwwwwwwwwk",
      "kzyxkkyyxkkzyxkk",
      "kzyxkkyyxkkzyxkk",
      "kyyxkkywxkkyyxkk",
      "kywxkkywxkkywxkk",
      "kwwwwwwwwwwwwwwk",
      "kyyzzzyyzzzyyzzk",
      "kwwwwwxwwwxwwwwk",
      "kywxkkywxkkywxkk",
      "kwwk..kwwk..kwwk",
      "kkkk..kkkk..kkkk",
    ],
  },
  {
    key: RUIN_PILLAR_TEXTURE_KEY,
    width: 16,
    height: 22,
    palette: LANDMARK_PALETTE,
    rows: [
      "....kkk..kkk....",
      "...kuvvkkvutk...",
      "..ktuvvvvvutsk..",
      "..kmnovvvuntsk..",
      "..kmnnvvvvuttk..",
      "...kstuuuuutk...",
      "....ktuvvvtk....",
      "....ktuuvutk....",
      "....kmuuvutk....",
      "....kmnnuutk....",
      "....ktnuvusk....",
      "....ktuvvutk....",
      "....ktuvutsk....",
      "....ktuvunmk....",
      "....kstumnmk....",
      "....kstuvutk....",
      "...kstuuvutsk...",
      "..kssuuvvuussk..",
      "..ktttuvvutttk..",
      "..kmnnstuuttmk..",
      "..kkkkkkkkkkkk..",
      "................",
    ],
  },
];

export function ensureForestLandmarkTextures(scene: Phaser.Scene): void {
  for (const spec of LANDMARK_SPRITES) {
    if (scene.textures.exists(spec.key)) continue;
    buildCanvasTexture(scene, spec);
  }
}

function buildCanvasTexture(scene: Phaser.Scene, spec: LandmarkSpriteSpec): void {
  const texture = scene.textures.createCanvas(spec.key, spec.width, spec.height);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, spec.width, spec.height);
  spec.rows.forEach((row, y) => paintPixelRow({ ctx, palette: spec.palette, row, y }));
  texture.refresh();
  texture.setFilter(NEAREST_FILTER);
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
