/** HD-pixel character skin tones, hair pigments, under-garments, and visible armor palettes. */

export interface ToneTriad {
  readonly base: string;
  readonly shade: string;
  readonly highlight: string;
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

export const HAIR_PALETTES: Readonly<Record<string, ToneTriad>> = {
  brown: { base: "#6d442b", shade: "#4b2d1b", highlight: "#8c5c3d" },
  black: { base: "#272d3a", shade: "#161a24", highlight: "#3f485c" },
  blonde: { base: "#e6b84c", shade: "#bd8d29", highlight: "#f8d67a" },
  red: { base: "#c2442e", shade: "#8f2b1b", highlight: "#e0674c" },
  silver: { base: "#cbd5e1", shade: "#94a3b8", highlight: "#f1f5f9" },
  teal: { base: "#2ba398", shade: "#1c7872", highlight: "#58ccbf" },
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
