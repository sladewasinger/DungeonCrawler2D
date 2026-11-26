/** CSS for the Item Card inspection popover and rarity slot accents. */

const ITEM_CARD_CSS = `
.ow-slot[data-rarity="uncommon"] { border-color: rgba(74, 222, 128, 0.72); box-shadow: inset 0 0 8px rgba(74, 222, 128, 0.22); }
.ow-slot[data-rarity="rare"] { border-color: rgba(96, 165, 250, 0.84); box-shadow: inset 0 0 10px rgba(59, 130, 246, 0.28); }
.ow-slot[data-rarity="epic"] { border-color: rgba(192, 132, 252, 0.9); box-shadow: inset 0 0 12px rgba(168, 85, 247, 0.34); }
.ow-slot[data-rarity="legendary"] { border-color: rgba(251, 191, 36, 0.96); box-shadow: inset 0 0 14px rgba(245, 158, 11, 0.42); }
.ow-slot[data-selected="true"] { border-color: #f59e0b; box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.65); }

.ow-item-card {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 56; width: min(340px, calc(100vw - 24px));
  padding: 14px; border-radius: 14px;
  background: rgba(10, 15, 24, 0.96); border: 2px solid rgba(148, 163, 184, 0.45);
  box-shadow: 0 20px 52px rgba(0, 0, 0, 0.78); backdrop-filter: blur(12px);
  color: #f8fafc; display: flex; flex-direction: column; gap: 10px;
}
.ow-item-card[data-anchored="true"] { transform: none; }
.ow-item-card[data-mode="hover"] { pointer-events: none; z-index: 55; opacity: 0.96; }
.ow-item-card[hidden] { display: none; }
.ow-ic-head { display: flex; align-items: center; gap: 12px; }
.ow-ic-icon-wrap {
  width: 64px; height: 64px; flex: 0 0 auto; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.92);
}
.ow-ic-icon { width: 52px; height: 52px; image-rendering: pixelated; }
.ow-ic-titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ow-ic-name { font-size: 16px; font-weight: 800; line-height: 1.2; }
.ow-ic-sub { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; }
.ow-ic-desc { font-size: 12px; line-height: 1.4; color: #cbd5e1; margin: 0; }
.ow-ic-stats {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 10px;
  padding: 8px 10px; border-radius: 10px;
  background: rgba(15, 23, 42, 0.78); border: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 12px;
}
.ow-ic-stat { display: flex; justify-content: space-between; gap: 4px; }
.ow-ic-stat-lbl { color: #94a3b8; }
.ow-ic-stat-val { font-weight: 800; color: #f8fafc; }
.ow-ic-delta[data-tone="better"] { color: #4ade80; margin-left: 3px; }
.ow-ic-delta[data-tone="worse"] { color: #f87171; margin-left: 3px; }
.ow-ic-perks { display: flex; flex-direction: column; gap: 4px; }
.ow-ic-perk {
  padding: 5px 8px; border-radius: 8px; font-size: 11px; font-weight: 700;
  color: #fde68a; background: rgba(120, 53, 15, 0.42); border: 1px solid rgba(251, 191, 36, 0.35);
}
.ow-ic-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-top: 2px; }
.ow-ic-btn {
  padding: 6px 11px; border-radius: 999px; font-size: 12px; font-weight: 700;
  border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(30, 41, 59, 0.9);
  color: #f8fafc; cursor: pointer;
}
.ow-ic-btn-primary { border-color: rgba(74, 222, 128, 0.7); background: rgba(20, 83, 45, 0.78); color: #bbf7d0; }
.ow-ic-btn-danger { border-color: rgba(248, 113, 113, 0.65); background: rgba(127, 29, 29, 0.65); color: #fecaca; }
`;

export function ensureItemCardStyles(): void {
  if (document.getElementById("ow-item-card-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-item-card-styles";
  style.textContent = ITEM_CARD_CSS;
  document.head.appendChild(style);
}
