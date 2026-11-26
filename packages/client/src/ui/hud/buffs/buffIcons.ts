/** Safe SVG icon markup for distinct survival buff and shrine badges. */
export type BuffIconId = "well-fed" | "invigorated" | "rested" | "salve" | "swiftness" | "vigor" | "shadow" | "god" | "poison" | "burn" | "web";

export const BUFF_SVG_ICONS: Readonly<Record<BuffIconId, string>> = {
  "well-fed": "<svg viewBox='0 0 24 24'><path fill='#fbbf24' d='M16 4c2.8 0 5 2.2 5 5 0 2.5-1.8 4.6-4.2 5L9.5 21.2l-2.1-2.1 1-1-1.4-1.4-2.1 2.1-1.4-1.4L10.7 10c.4-3.4 2.4-6 5.3-6z'/></svg>",
  invigorated: "<svg viewBox='0 0 24 24'><path fill='#2dd4bf' d='M5 10h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6zm11 1h2a2 2 0 0 1 0 4h-2v-4zM8 4l1 3m4-3l1 3' stroke='#99f6e4' stroke-width='1.8' stroke-linecap='round'/></svg>",
  rested: "<svg viewBox='0 0 24 24'><path fill='#38bdf8' d='M12 3c2 3.5 5 5.6 5 9.5a5 5 0 1 1-10 0c0-2.1 1-4.1 2.5-5.8.2 1.8 1.2 2.9 2.5 3.3C11.4 7.8 11.7 5.5 12 3z'/></svg>",
  salve: "<svg viewBox='0 0 24 24'><path fill='#4ade80' d='M19 4C11 4 6 9 6 17c0 1.4.4 2.6 1 3l3-3c1.5.5 3.5.3 5-1.2C18 12.8 19 8.5 19 4z'/></svg>",
  swiftness: "<svg viewBox='0 0 24 24'><path fill='#38bdf8' d='M4 9h12l-2.5-2.5L15 5l5 5-5 5-1.5-1.5L16 11H4V9z'/></svg>",
  vigor: "<svg viewBox='0 0 24 24'><path fill='#4ade80' d='M12 20s-7-4.5-7-9.5A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.5C19 15.5 12 20 12 20z'/></svg>",
  shadow: "<svg viewBox='0 0 24 24'><path fill='#c084fc' d='M15 4a8 8 0 1 0 5 14.3A7 7 0 0 1 15 4z'/></svg>",
  god: "<svg viewBox='0 0 24 24'><path fill='#fde047' d='M12 3l2.6 5.4 6 .8-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.2l6-.8L12 3z'/></svg>",
  poison: "<svg viewBox='0 0 24 24'><path fill='#4ade80' d='M12 3c-3.5 5-6 8.2-6 11.5a6 6 0 1 0 12 0C18 11.2 15.5 8 12 3z'/></svg>",
  burn: "<svg viewBox='0 0 24 24'><path fill='#fb923c' d='M12 2c3 4 6 7 6 11a6 6 0 1 1-12 0c0-3 2-5.5 3-7 0 2 1 3 2 3-1-2-.5-4.5 1-7z'/></svg>",
  web: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='7' fill='none' stroke='#cbd5e1' stroke-width='2'/><path stroke='#cbd5e1' stroke-width='1.5' d='M12 5v14M5 12h14'/></svg>",
};
