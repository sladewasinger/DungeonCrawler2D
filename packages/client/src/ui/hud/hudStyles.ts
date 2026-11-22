/** Styles for the larger bottom hotbar, minimalist inventory modal, crafting panel, and drag ghost. */

const HUD_CSS = `
:root {
  --ow-slot-size: clamp(35px, calc((100vw - 74px) / 9), 58px);
  --ow-bag-slot: clamp(32px, calc((100vw - 88px) / 9), 50px);
}
.ow-hotbar {
  position: fixed; left: 50%; bottom: max(12px, env(safe-area-inset-bottom));
  transform: translateX(-50%); z-index: 40;
  display: grid; grid-template-columns: repeat(9, var(--ow-slot-size)); gap: 6px; padding: 8px 10px;
  border-radius: 14px; background: rgba(12, 18, 26, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.28); backdrop-filter: blur(8px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}
.ow-slot {
  position: relative; width: var(--ow-slot-size); height: var(--ow-slot-size); padding: 0;
  border-radius: 10px; border: 2px solid rgba(148, 163, 184, 0.25); background: rgba(15, 23, 42, 0.9);
  display: flex; align-items: center; justify-content: center;
  cursor: grab; touch-action: none; color: #f8fafc;
}
.ow-bag-slot { width: var(--ow-bag-slot); height: var(--ow-bag-slot); }
.ow-slot[data-selected="true"] {
  border-color: #f59e0b; background: rgba(120, 53, 15, 0.45);
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.55);
}
.ow-slot[data-tap-source="true"] {
  border-color: #38bdf8; box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.65);
}
.ow-slot-img { width: 72%; height: 72%; image-rendering: pixelated; pointer-events: none; }
.ow-slot-key {
  position: absolute; left: 4px; top: 2px; font-size: 10px; font-weight: 700;
  color: rgba(203, 213, 225, 0.65); pointer-events: none;
}
.ow-slot-hint {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  color: rgba(148, 163, 184, 0.72); pointer-events: none;
}
.ow-slot-count {
  position: absolute; right: 4px; bottom: 2px; font-size: 11px; font-weight: 800;
  color: #f8fafc; text-shadow: 0 1px 2px #000, 0 0 2px #000; pointer-events: none;
}
.ow-modal {
  position: fixed; left: 50%;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--ow-slot-size) + 28px);
  transform: translateX(-50%); z-index: 30;
  width: min(640px, calc(100vw - 20px)); max-height: calc(100dvh - var(--ow-slot-size) - 110px);
  overflow-y: auto; padding: 12px 14px; border-radius: 14px;
  background: rgba(12, 18, 26, 0.9); border: 1px solid rgba(148, 163, 184, 0.28);
  backdrop-filter: blur(10px); box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55); color: #f1f5f9;
}
.ow-modal[hidden] { display: none; }
.ow-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 10px; font-size: 14px; font-weight: 700;
}
.ow-inv-body { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; }
.ow-armor-wrap { display: flex; flex-direction: column; gap: 8px; }
.ow-armor-grid { display: grid; grid-template-columns: repeat(2, var(--ow-bag-slot)); gap: 5px; }
.ow-stats-box {
  display: flex; flex-direction: column; gap: 3px; padding: 8px; border-radius: 8px;
  background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 12px; color: #cbd5e1;
}
.ow-backpack-grid { display: grid; grid-template-columns: repeat(9, var(--ow-bag-slot)); gap: 5px; }
.ow-craft-list { display: flex; flex-direction: column; gap: 8px; }
.ow-craft-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px;
  background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2);
}
.ow-craft-info { flex: 1; min-width: 0; }
.ow-craft-title { font-size: 13px; font-weight: 700; color: #f8fafc; }
.ow-craft-sub { font-size: 11px; color: #94a3b8; }
.ow-drag-ghost {
  position: fixed; width: 44px; height: 44px; pointer-events: none; z-index: 60;
  transform: translate(-50%, -50%) scale(1.1); image-rendering: pixelated;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.65));
}
@media (max-width: 620px) {
  .ow-hotbar { gap: 3px; padding: 6px; }
  .ow-inv-body { grid-template-columns: 1fr; }
  .ow-armor-grid { grid-template-columns: repeat(4, var(--ow-bag-slot)); }
}
`;

export function ensureHudStyles(): void {
  if (document.getElementById("ow-phase2-hud-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-phase2-hud-styles";
  style.textContent = HUD_CSS;
  document.head.appendChild(style);
}
