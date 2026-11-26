/** Isolated styles for 28x28 icon buff tray, radial countdown rings, tooltips, and placement/warming bars. */
const BUFF_TRAY_CSS = `
.ow-buff-tray { display: inline-flex; align-items: center; gap: 4px; pointer-events: auto; }
.ow-buff-badge {
  position: relative; width: 28px; height: 28px; padding: 0; border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.9);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
}
.ow-buff-badge svg.ow-buff-svg { width: 16px; height: 16px; pointer-events: none; z-index: 1; }
.ow-buff-ring { position: absolute; inset: 0; width: 28px; height: 28px; pointer-events: none; transform: rotate(-90deg); }
.ow-buff-sec {
  position: absolute; right: 1px; bottom: 0; font-size: 8px; font-weight: 800; line-height: 1;
  color: #f8fafc; text-shadow: 0 1px 2px #000; z-index: 2; pointer-events: none;
}
.ow-buff-tooltip {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--ow-slot-size, 44px) + 56px);
  z-index: 44; padding: 4px 10px; border-radius: 8px;
  background: rgba(12, 18, 26, 0.95); color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.45); font-size: 11px; font-weight: 700; pointer-events: none;
}
.ow-buff-tooltip[hidden], .ow-buff-tray[hidden], .ow-warming-bar[hidden], .ow-placement-badge[hidden] { display: none; }
.ow-warming-bar {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--ow-slot-size, 44px) + 92px);
  z-index: 42; width: 132px; height: 14px; border-radius: 999px; overflow: hidden;
  background: rgba(12, 18, 26, 0.88); border: 1px solid rgba(251, 146, 60, 0.65); pointer-events: none;
}
.ow-warming-fill { height: 100%; background: linear-gradient(90deg, #f97316, #fbbf24); transition: width 90ms linear; }
.ow-warming-label {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 800; color: #fff7ed; text-shadow: 0 1px 2px #000;
}
.ow-placement-badge {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--ow-slot-size, 44px) + 110px);
  z-index: 42; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
  background: rgba(12, 18, 26, 0.88); border: 1px solid rgba(148, 163, 184, 0.35); pointer-events: none;
}
.ow-craft-stations { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ow-station-pill {
  padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 800;
  border: 1px solid rgba(148, 163, 184, 0.3); color: #94a3b8; background: rgba(15, 23, 42, 0.7);
}
.ow-station-pill[data-active="true"] { color: #fde68a; border-color: rgba(251, 191, 36, 0.7); background: rgba(120, 53, 15, 0.55); }
@media (hover: none), (pointer: coarse), (max-width: 900px) {
  .ow-buff-badge, .ow-buff-ring { width: 22px; height: 22px; }
  .ow-buff-badge svg.ow-buff-svg { width: 13px; height: 13px; }
}
`;

export function ensureBuffTrayStyles(): void {
  if (document.getElementById("ow-buff-tray-css")) return;
  const style = document.createElement("style");
  style.id = "ow-buff-tray-css";
  style.textContent = BUFF_TRAY_CSS;
  document.head.appendChild(style);
}
