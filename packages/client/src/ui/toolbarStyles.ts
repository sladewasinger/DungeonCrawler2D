/** Mobile-first styles for the atmosphere toolbar and floating touch joystick. */

const TOOLBAR_CSS = `
.ow-hud {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  width: max-content;
  max-width: calc(100vw - 180px);
  z-index: 20;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.ow-bar {
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(12, 18, 26, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.25);
  backdrop-filter: blur(8px);
  color: #f1f5f9;
  font-size: 13px;
}
.ow-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ow-pill[data-active="true"] {
  border-color: #f59e0b;
  background: rgba(120, 53, 15, 0.75);
}
.ow-pill[hidden] { display: none; }
.ow-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #38bdf8;
}
.ow-dot[data-mode="server"] { background: #22c55e; }
.ow-dot[data-mode="connecting"] { background: #f59e0b; }
.ow-dot[data-mode="reconnecting"] { background: #ef4444; }
.ow-drawer {
  pointer-events: auto;
  display: none;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(12, 18, 26, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.25);
  backdrop-filter: blur(8px);
  max-width: min(360px, 100%);
}
.ow-drawer[data-open="true"] { display: flex; }
.ow-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.ow-slider { width: 100%; accent-color: #f59e0b; }
.ow-joystick {
  position: fixed;
  display: none;
  width: 104px;
  height: 104px;
  margin-left: -52px;
  margin-top: -52px;
  border-radius: 999px;
  border: 2px solid rgba(248, 250, 252, 0.35);
  background: rgba(15, 23, 42, 0.35);
  pointer-events: none;
  z-index: 15;
}
.ow-joystick__knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  background: rgba(248, 250, 252, 0.72);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}
.ow-zoom-controls {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  right: max(10px, env(safe-area-inset-right));
  z-index: 25;
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  border-radius: 12px;
  background: rgba(12, 18, 26, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.25);
  backdrop-filter: blur(8px);
}
.ow-zoom-btn {
  min-width: 30px;
  justify-content: center;
  padding: 5px 8px;
  font-size: 15px;
  line-height: 1;
}
.ow-audio-popover {
  position: fixed;
  top: calc(max(10px, env(safe-area-inset-top)) + 44px);
  right: max(10px, env(safe-area-inset-right));
  z-index: 32;
  width: min(230px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(12, 18, 26, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.28);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  color: #f8fafc;
  font-size: 13px;
}
.ow-audio-popover[hidden] { display: none; }
.ow-audio-head, .ow-audio-row-head { display: flex; align-items: center; justify-content: space-between; font-weight: 700; }
.ow-audio-row { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #cbd5e1; }
.ow-audio-pct { font-variant-numeric: tabular-nums; color: #94a3b8; }
.ow-combat-cluster {
  display: none;
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 35;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.ow-combat-row { display: flex; align-items: flex-end; gap: 8px; }
.ow-touch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 2px solid rgba(248, 250, 252, 0.35);
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  color: #f8fafc;
  font-weight: 800;
  touch-action: none;
  cursor: pointer;
}
.ow-touch-btn[hidden] { display: none; }
.ow-atk-btn { width: 58px; height: 58px; font-size: 13px; border-color: rgba(248, 113, 113, 0.55); }
.ow-atk-btn[data-role="heal"] { border-color: rgba(74, 222, 128, 0.65); color: #bbf7d0; }
.ow-atk-btn[data-role="bow"] { border-color: rgba(251, 191, 36, 0.65); color: #fef08a; }
.ow-atk-btn[data-role="map"] { border-color: rgba(56, 189, 248, 0.65); color: #bae6fd; }
.ow-jump-btn { width: 48px; height: 48px; font-size: 11px; padding: 0; }
.ow-roll-btn, .ow-block-btn { width: 46px; height: 46px; font-size: 9px; padding: 0; }
.ow-sneak-btn[data-active="true"] { background: rgba(6, 95, 70, 0.88); border-color: #34d399; color: #a7f3d0; }
.ow-touch-btn:active, .ow-touch-btn[data-active="true"] {
  background: rgba(180, 83, 9, 0.85);
  border-color: #f59e0b;
}
.ow-fps-pill {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 800;
  min-width: 58px;
  justify-content: center;
}
.ow-fps-pill[data-tier="good"] { color: #4ade80; border-color: rgba(74, 222, 128, 0.35); }
.ow-fps-pill[data-tier="warn"] { color: #fbbf24; border-color: rgba(251, 191, 36, 0.45); }
.ow-fps-pill[data-tier="low"] { color: #f87171; border-color: rgba(248, 113, 113, 0.5); }
:root[data-input-mode="touch"] .ow-combat-cluster {
  display: flex;
}
@media (hover: none), (pointer: coarse) {
  .ow-combat-cluster { display: flex; }
}
@media (max-width: 1180px) {
  .ow-combat-cluster {
    bottom: max(76px, calc(env(safe-area-inset-bottom) + 64px));
  }
}
`;

export function ensureToolbarStyles(): void {
  if (document.getElementById("ow-hud-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-hud-styles";
  style.textContent = TOOLBAR_CSS;
  document.head.appendChild(style);
}
