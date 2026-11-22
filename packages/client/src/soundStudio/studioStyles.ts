/** Standalone dark DAW stylesheet for Sound Studio (cleanly decoupled from gameplay HUD). */

const STUDIO_CSS = `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; min-height: 100%; background: #0b1118; color: #e2e8f0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.st-shell { max-width: 1120px; margin: 0 auto; padding: 18px 16px 42px; display: flex; flex-direction: column; gap: 12px; }
.st-top {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 16px; border-radius: 12px; background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.24);
}
.st-brand { font-size: 18px; font-weight: 900; letter-spacing: 0.04em; color: #ffd23d; }
.st-sub { font-size: 12px; color: #94a3b8; }
.st-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.st-btn, .st-select {
  padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.3);
  background: #131e2e; color: #f8fafc; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none;
}
.st-btn:hover { background: #1e293b; border-color: rgba(251, 191, 36, 0.55); }
.st-btn-play { background: linear-gradient(135deg, #059669, #047857); border-color: #34d399; color: #ecfdf5; }
.st-btn-save { background: rgba(30, 58, 138, 0.55); border-color: rgba(96, 165, 250, 0.55); color: #dbeafe; }
.st-btn[data-active="true"] { background: #78350f; border-color: #fbbf24; color: #fef08a; }
.st-btn-danger { border-color: rgba(248, 113, 113, 0.45); color: #fca5a5; }
.st-dirty-badge {
  padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800;
  color: #fde047; background: rgba(120, 53, 15, 0.65); border: 1px solid rgba(251, 191, 36, 0.55);
}
.st-dirty-badge[hidden] { display: none; }
.st-save-input {
  padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.32);
  background: #090f17; color: #f8fafc; font-size: 12px; font-weight: 600; width: 168px;
}
.st-viz-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.st-viz-card, .st-timeline-card {
  padding: 10px; border-radius: 10px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex; flex-direction: column; gap: 6px;
}
.st-viz-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.st-timeline-meta {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 11px; color: #cbd5e1; font-weight: 600;
}
.st-canvas { width: 100%; height: 120px; border-radius: 6px; display: block; }
.st-timeline-canvas { width: 100%; height: auto; border-radius: 6px; display: block; touch-action: none; }
.st-tracks { display: flex; flex-direction: column; gap: 10px; }
.st-track {
  padding: 12px; border-radius: 12px; background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.22); display: flex; flex-direction: column; gap: 10px;
}
.st-track-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
.st-name { padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.3); background: #090f17; color: #f8fafc; font-weight: 700; font-size: 13px; width: 170px; }
.st-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; }
.st-field { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #cbd5e1; }
.st-field input[type="range"] { width: 100%; accent-color: #38bdf8; }
.st-status { font-size: 12px; color: #34d399; font-weight: 700; min-height: 16px; }
@media (max-width: 720px) { .st-viz-row { grid-template-columns: 1fr; } }
`;

export function ensureStudioStyles(): void {
  if (document.getElementById("ow-sound-studio-css")) return;
  const style = document.createElement("style");
  style.id = "ow-sound-studio-css";
  style.textContent = STUDIO_CSS;
  document.head.appendChild(style);
}
