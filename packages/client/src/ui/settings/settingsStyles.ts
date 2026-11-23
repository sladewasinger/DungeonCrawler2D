/** Styles for unified desktop/mobile Settings modal and compact HUD icon buttons. */

const SETTINGS_CSS = `
.ow-icon-pill {
  padding: 6px 8px;
  justify-content: center;
}
.ow-icon-pill svg { display: block; pointer-events: none; }
.ow-settings-backdrop {
  position: fixed; inset: 0; z-index: 48;
  display: flex; align-items: center; justify-content: center; padding: 14px;
  background: rgba(6, 10, 16, 0.56); backdrop-filter: blur(4px);
}
.ow-settings-backdrop[hidden] { display: none; }
.ow-settings-modal {
  width: min(420px, 100%); max-height: min(86dvh, 660px); overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px; padding: 14px 16px;
  border-radius: 14px; background: rgba(12, 18, 26, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.3); box-shadow: 0 18px 46px rgba(0, 0, 0, 0.65);
  color: #f8fafc; font-size: 13px;
}
.ow-settings-head { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 800; }
.ow-settings-section {
  display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 10px;
  background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.16);
}
.ow-settings-sec-title {
  font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8;
}
.ow-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.ow-settings-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.ow-settings-danger { border-color: rgba(248, 113, 113, 0.45); color: #fecaca; }
.ow-settings-zoom-val { min-width: 38px; text-align: center; font-weight: 700; color: #fde047; font-variant-numeric: tabular-nums; }
`;

export function ensureSettingsStyles(): void {
  if (document.getElementById("ow-settings-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-settings-styles";
  style.textContent = SETTINGS_CSS;
  document.head.appendChild(style);
}