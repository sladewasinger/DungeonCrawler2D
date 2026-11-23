/** HD-pixel character skin tones, hair pigments, under-garments, and visible armor palettes. */

export interface ToneTriad {
  readonly base: string;
  readonly shade: string;
  readonly highlight: string;
}

export interface HairPalette extends ToneTriad {
  readonly tip?: ToneTriad;
}

export interface ArmorVisualStyle extends ToneTriad {
  readonly accent: string;
}

export const SKIN_PALETTES: Readonly<Record<string, ToneTriad>> = {
  fair: { base: "#f8d8c0", shade: "#d9ac8f", highlight: "#ffece0" },
  warm: { base: "#ecc096", shade: "#c79468", highlight: "#f8d7b6" },
  tan: { base: "#d69d6b", shade: "#af7647", highlight: "#e7b78a" },
  bronze: { base: "#a96f45", shade: "#824e2b", highlight: "#c48b60" },
  deep: { base: "#6f4531", shade: "#4d2d1f", highlight: "#8b5c44" },
};

export const EYE_PALETTES: Readonly<Record<string, ToneTriad>> = {
  brown: { base: "#5c361c", shade: "#26160c", highlight: "#8c5730" },
  blue: { base: "#2563eb", shade: "#172554", highlight: "#60a5fa" },
  green: { base: "#15803d", shade: "#052e16", highlight: "#4ade80" },
  hazel: { base: "#856a25", shade: "#2c2208", highlight: "#ca9e3d" },
  amber: { base: "#d97706", shade: "#451a03", highlight: "#fbbf24" },
  violet: { base: "#7c3aed", shade: "#2e1065", highlight: "#c084fc" },
};

export const HAIR_PALETTES: Readonly<Record<string, HairPalette>> = {
  brown: { base: "#6d442b", shade: "#4b2d1b", highlight: "#8c5c3d" },
  black: { base: "#272d3a", shade: "#161a24", highlight: "#3f485c" },
  blonde: { base: "#e6b84c", shade: "#bd8d29", highlight: "#f8d67a" },
  red: { base: "#c2442e", shade: "#8f2b1b", highlight: "#e0674c" },
  silver: { base: "#cbd5e1", shade: "#94a3b8", highlight: "#f1f5f9" },
  teal: { base: "#2ba398", shade: "#1c7872", highlight: "#58ccbf" },
  auburn: { base: "#933b22", shade: "#642212", highlight: "#bc5737" },
  midnight: { base: "#1e294b", shade: "#11172b", highlight: "#364a80" },
  rose: { base: "#e15b8c", shade: "#ad3664", highlight: "#f48bb2" },
  violet: { base: "#7c3aed", shade: "#5221ab", highlight: "#a775f7" },
  emerald: { base: "#199457", shade: "#0f6339", highlight: "#3ec980" },
  white: { base: "#e2e8f0", shade: "#b8c4d4", highlight: "#ffffff" },
  "pink-purple": {
    base: "#f472b6", shade: "#be3e85", highlight: "#fbcfe8",
    tip: { base: "#7c3aed", shade: "#4c1d95", highlight: "#a78bfa" },
  },
  "black-red": {
    base: "#222733", shade: "#12151e", highlight: "#384152",
    tip: { base: "#dc2626", shade: "#991b1b", highlight: "#f87171" },
  },
  "midnight-cyan": {
    base: "#1e294b", shade: "#11182c", highlight: "#33477a",
    tip: { base: "#06b6d4", shade: "#0e7490", highlight: "#67e8f9" },
  },
  "sunset-gold": {
    base: "#dc4a2d", shade: "#9a2b17", highlight: "#f97316",
    tip: { base: "#facc15", shade: "#ca8a04", highlight: "#fef08a" },
  },
  "emerald-teal": {
    base: "#15803d", shade: "#0b5327", highlight: "#22c55e",
    tip: { base: "#14b8a6", shade: "#0f766e", highlight: "#5eead4" },
  },
  "silver-violet": {
    base: "#cbd5e1", shade: "#94a3b8", highlight: "#f8fafc",
    tip: { base: "#8b5cf6", shade: "#5b21b6", highlight: "#c4b5fd" },
  },
};

export const UNDERWEAR_PALETTE = {
  shirt: "#64748b",
  shirtShade: "#475569",
  shirtHighlight: "#94a3b8",
  pants: "#3b4252",
  pantsShade: "#272d38",
} as const;

export const ARMOR_VISUAL_STYLES: Readonly<Record<string, ArmorVisualStyle>> = {
  "leather-hood": { base: "#9a4622", shade: "#6f2e15", highlight: "#bd5d30", accent: "#f59e0b" },
  "leather-tunic": { base: "#8e401e", shade: "#662b13", highlight: "#b5582c", accent: "#f59e0b" },
  "leather-leggings": { base: "#72361c", shade: "#4f2311", highlight: "#914828", accent: "#cbd5e1" },
  "leather-boots": { base: "#572814", shade: "#3b190c", highlight: "#783a20", accent: "#d97706" },
};

export function getArmorVisualStyle(itemId: string | null | undefined): ArmorVisualStyle | undefined {
  return itemId ? ARMOR_VISUAL_STYLES[itemId] : undefined;
}
