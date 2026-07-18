// Hex/RGB color math shared by every generator that derives new tones from sampled pack colors.

/** @param {string} hex '#rrggbb' @returns {[number,number,number]} */
export function hexToRgb(hex) {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

/** @param {[number,number,number]} rgb @returns {string} '#rrggbb' */
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Scale each channel toward black by `factor` (0..1); used to derive dark/mid tones from an accent. */
export function scaleColor(hex, factor) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * factor, g * factor, b * factor]);
}

/** Linear-blend two hex colors; `amount` 0 = a, 1 = b. */
export function mixColor(a, b, amount) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount]);
}

/** @returns {[number,number,number,number]} RGBA with full opacity */
export function opaque(hex) {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, 255];
}
