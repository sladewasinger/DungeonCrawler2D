// Minimal built-in 3x5 pixel font (no external font dependency) used only to label
// contact-sheet.png so a human can tell which generated sprite is which.
const GLYPHS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '##.', '#.#', '.##'],
  7: ['###', '..#', '.#.', '#..', '#..'],
  8: ['.#.', '#.#', '.#.', '#.#', '.#.'],
  9: ['.##', '#.#', '.##', '..#', '.##'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '.##', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  _: ['...', '...', '...', '...', '###'],
  '-': ['...', '...', '###', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'],
};

function drawGlyphRow({ canvas, line, x, y, rgba, scale }) {
  for (let col = 0; col < line.length; col++) {
    if (line[col] !== '#') continue;
    canvas.fillRect(x + col * scale, y, scale, scale, rgba);
  }
}

function drawGlyph({ canvas, glyph, x, y, rgba, scale }) {
  glyph.forEach((line, row) => drawGlyphRow({
    canvas, line, x, y: y + row * scale, rgba, scale,
  }));
}

/** Draws `text` (case-insensitive) with each font pixel drawn as a scaled block. */
export function drawText(canvas, { text, x, y, rgba, scale = 1 }) {
  let cursorX = x;
  for (const rawChar of text.toUpperCase()) {
    drawGlyph({ canvas, glyph: GLYPHS[rawChar] ?? GLYPHS[' '], x: cursorX, y, rgba, scale });
    cursorX += 4 * scale;
  }
  return cursorX;
}

export function textWidth(text, scale = 1) {
  return text.length * 4 * scale;
}
