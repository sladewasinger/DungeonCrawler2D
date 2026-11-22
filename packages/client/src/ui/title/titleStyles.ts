/** Styles for the pre-game Title Screen overlay, character customizer card, and localhost dev link. */

const TITLE_CSS = `
[data-title-open="true"] .ow-hud,
[data-title-open="true"] .ow-hotbar,
[data-title-open="true"] .ow-vitals,
[data-title-open="true"] .ow-zoom-controls,
[data-title-open="true"] .ow-jump-btn,
[data-title-open="true"] .ow-combat-cluster,
[data-title-open="true"] .ow-chest-prompt {
  display: none !important;
}
.ow-title-backdrop {
  position: fixed; inset: 0; z-index: 70;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; overflow-y: auto;
  background: radial-gradient(circle at 50% 35%, rgba(12, 18, 26, 0.45), rgba(8, 12, 18, 0.84));
  backdrop-filter: blur(4px);
}
.ow-title-backdrop[hidden] { display: none; }
.ow-title-card {
  width: min(490px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto;
  padding: 20px 22px; border-radius: 16px;
  background: rgba(12, 18, 26, 0.92);
  border: 1px solid rgba(251, 191, 36, 0.38);
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.68);
  color: #f8fafc; display: flex; flex-direction: column; gap: 14px;
}
.ow-title-header { text-align: center; }
.ow-title-heading {
  margin: 0; font-size: clamp(22px, 4.4vw, 30px); font-weight: 900; letter-spacing: 0.08em;
  text-transform: uppercase; color: #ffd23d; text-shadow: 0 2px 12px rgba(245, 158, 11, 0.35);
}
.ow-title-sub { margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.04em; }
.ow-title-hero-row { display: flex; align-items: center; gap: 14px; }
.ow-title-portrait {
  width: 80px; height: 80px; flex-shrink: 0; object-fit: contain; image-rendering: pixelated;
  border-radius: 12px; background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.28); padding: 4px;
}
.ow-title-name-box { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.ow-title-label { font-size: 11px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; }
.ow-title-name {
  width: 100%; padding: 9px 12px; border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(15, 23, 42, 0.95);
  color: #f8fafc; font-size: 15px; font-weight: 700; outline: none;
}
.ow-title-name:focus { border-color: #fbbf24; box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.25); }
.ow-title-enter {
  width: 100%; padding: 12px 18px; border-radius: 12px; border: 1px solid #fbbf24;
  background: linear-gradient(135deg, #d97706, #b45309); color: #fefce8;
  font-size: 15px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase;
  cursor: pointer; touch-action: manipulation; box-shadow: 0 6px 20px rgba(217, 119, 6, 0.35);
}
.ow-title-enter:hover { filter: brightness(1.1); }
.ow-title-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 11px; color: #64748b; }
.ow-title-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ow-studio-link {
  color: #7dd3fc; font-weight: 700; text-decoration: none;
  padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.38);
  background: rgba(14, 116, 144, 0.22);
}
.ow-studio-link:hover { background: rgba(14, 116, 144, 0.38); }
`;

export function ensureTitleStyles(): void {
  if (document.getElementById("ow-title-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-title-styles";
  style.textContent = TITLE_CSS;
  document.head.appendChild(style);
}
