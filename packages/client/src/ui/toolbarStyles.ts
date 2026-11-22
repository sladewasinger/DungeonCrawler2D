/** Mobile-first styles for the atmosphere toolbar and floating touch joystick. */

const TOOLBAR_CSS = `
.ow-hud {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  right: max(92px, calc(env(safe-area-inset-right) + 84px));
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
.ow-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #38bdf8;
}
.ow-dot[data-mode="server"] { background: #22c55e; }
.ow-dot[data-mode="connecting"] { background: #f59e0b; }
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
.ow-jump-btn {
  display: none;
  position: fixed;
  right: max(14px, env(safe-area-inset-right));
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + clamp(35px, calc((100vw - 74px) / 9), 58px) + 26px);
  z-index: 35;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  border: 2px solid rgba(248, 250, 252, 0.35);
  background: rgba(15, 23, 42, 0.68);
  backdrop-filter: blur(8px);
  color: #f8fafc;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  touch-action: none;
  cursor: pointer;
}
.ow-jump-btn:active {
  background: rgba(180, 83, 9, 0.8);
  border-color: #f59e0b;
}
@media (hover: none), (pointer: coarse), (max-width: 900px) {
  .ow-jump-btn { display: flex; align-items: center; justify-content: center; }
}
`;

export function ensureToolbarStyles(): void {
  if (document.getElementById("ow-hud-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-hud-styles";
  style.textContent = TOOLBAR_CSS;
  document.head.appendChild(style);
}
