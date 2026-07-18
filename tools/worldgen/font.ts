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
const GLYPH_H = 5;

/** Draws one uppercase character at `scale` px per font pixel. Unknown chars are blank. */
export function drawChar(
  canvas: Canvas,
  x: number,
  y: number,
  ch: string,
  color: Rgb,
  scale: number,
): void {
  const glyph = GLYPHS[ch.toUpperCase()];
  if (!glyph) return;
  for (let row = 0; row < GLYPH_H; row++) {
    const line = glyph[row];
    for (let col = 0; col < GLYPH_W; col++) {
      if (line[col] !== "#") continue;
      canvas.fillRect(x + col * scale, y + row * scale, scale, scale, color);
    }
  }
}

export function drawText(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
  color: Rgb,
  scale: number,
): void {
  const advance = (GLYPH_W + 1) * scale;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== undefined && ch !== " ") drawChar(canvas, x + i * advance, y, ch, color, scale);
  }
}
