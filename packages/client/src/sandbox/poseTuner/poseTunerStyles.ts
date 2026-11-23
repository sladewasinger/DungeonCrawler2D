/** Injected CSS styles for the right-side Sandbox Pose Tuner drawer. */
const POSE_TUNER_CSS = `
.pt-drawer {
  position: fixed; top: 54px; right: 10px; bottom: 10px; width: 326px; z-index: 46;
  display: flex; flex-direction: column; gap: 7px; padding: 9px 10px; overflow-y: auto;
  border-radius: 12px; background: rgba(11, 17, 27, 0.94); backdrop-filter: blur(8px);
  border: 1px solid rgba(251, 191, 36, 0.35); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
  color: #f1f5f9; font-size: 11px; pointer-events: auto;
}
.pt-drawer.pt-hidden { display: none; }
.pt-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.pt-title { font-weight: 900; font-size: 12px; color: #fde047; letter-spacing: 0.06em; }
.pt-sec {
  display: flex; flex-direction: column; gap: 5px; padding: 7px 8px;
  border-radius: 8px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.16);
}
.pt-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
.pt-pills { display: flex; flex-wrap: wrap; gap: 3px; }
.pt-btn {
  padding: 3px 7px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(30, 41, 59, 0.9); color: #e2e8f0; font-size: 11px; font-weight: 700; cursor: pointer;
}
.pt-btn:hover { background: rgba(51, 65, 85, 0.95); }
.pt-btn[data-active="true"] { background: #b45309; border-color: #fbbf24; color: #fefce8; }
.pt-btn-save { background: #047857; border-color: #34d399; color: #ecfdf5; }
.pt-btn-save:hover { background: #059669; }
.pt-btn-warn { background: #7f1d1d; border-color: #f87171; color: #fef2f2; }
.pt-btn-warn:hover { background: #991b1b; }
.pt-slider-row { display: grid; grid-template-columns: 90px 1fr 44px; align-items: center; gap: 6px; }
.pt-slider-row input[type="range"] { width: 100%; accent-color: #f59e0b; cursor: pointer; }
.pt-val { font-family: monospace; font-size: 11px; text-align: right; color: #fde68a; }
.pt-checks { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
.pt-check { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #e2e8f0; cursor: pointer; }
.pt-check input { accent-color: #f59e0b; cursor: pointer; }
.pt-status { min-height: 15px; font-size: 11px; font-weight: 700; color: #6ee7b7; }
.pt-status.pt-err { color: #fca5a5; }
`;

export function ensurePoseTunerStyles(): void {
  if (document.getElementById("ow-pose-tuner-css")) return;
  const el = document.createElement("style");
  el.id = "ow-pose-tuner-css";
  el.textContent = POSE_TUNER_CSS;
  document.head.appendChild(el);
}
