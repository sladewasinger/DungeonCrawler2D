// A minimal 3x5 pixel font for the legend strip only — this is dev tooling,
// not the game client, so VISUAL_DIRECTION's "no default fonts" UI rule
// (which governs in-game rendering) does not apply here.

import type { Canvas } from "./canvas.js";
import type { Rgb } from "./colors.js";

type Glyph = readonly [string, string, string, string, string];

const GLYPHS: Readonly<Record<string, Glyph>> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  L: ["#..", "#..", "#..", "#..", "###"],
  N: ["#.#", "##.", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "#.#", "###", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
};

const GLYPH_W = 3;

/** Draws one uppercase character at `scale` px per font pixel. Unknown chars are blank. */
function drawGlyphRow({ canvas, x, y, line, color, scale }: {
  canvas: Canvas;
  x: number;
  y: number;
  line: string;
  color: Rgb;
  scale: number;
}): void {
  for (let col = 0; col < GLYPH_W; col++) {
    if (line[col] !== "#") continue;
    canvas.fillRect(x + col * scale, y, scale, scale, color);
  }
}

export function drawChar({ canvas, x, y, ch, color, scale }: {
  canvas: Canvas;
  x: number;
  y: number;
  ch: string;
  color: Rgb;
  scale: number;
}): void {
  const glyph = GLYPHS[ch.toUpperCase()];
  if (!glyph) return;
  glyph.forEach((line, row) => drawGlyphRow({
    canvas, x, y: y + row * scale, line, color, scale,
  }));
}

export function drawText({ canvas, x, y, text, color, scale }: {
  canvas: Canvas;
  x: number;
  y: number;
  text: string;
  color: Rgb;
  scale: number;
}): void {
  const advance = (GLYPH_W + 1) * scale;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== undefined && ch !== " ") drawChar({ canvas, x: x + i * advance, y, ch, color, scale });
  }
}
