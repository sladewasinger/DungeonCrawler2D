/** Full-screen responsive dark DAW stylesheet for Sound Studio (cleanly decoupled from gameplay HUD). */

const STUDIO_CSS = `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; min-height: 100%; background: #0b1118; color: #e2e8f0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.st-shell {
  width: 100%; max-width: none; min-height: 100vh;
  padding: 14px clamp(16px, 2.5vw, 32px) 28px; display: flex; flex-direction: column; gap: 12px;
}
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
.st-btn:disabled { opacity: 0.35; cursor: default; }
.st-btn-play { background: linear-gradient(135deg, #059669, #047857); border-color: #34d399; color: #ecfdf5; }
.st-btn-save { background: rgba(30, 58, 138, 0.55); border-color: rgba(96, 165, 250, 0.55); color: #dbeafe; }
.st-btn[data-active="true"] { background: #78350f; border-color: #fbbf24; color: #fef08a; }
.st-btn-danger { border-color: rgba(248, 113, 113, 0.45); color: #fca5a5; }
.st-dirty-badge {
  padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800;
  color: #fde047; background: rgba(120, 53, 15, 0.65); border: 1px solid rgba(251, 191, 36, 0.55);
}
.st-dirty-badge[hidden], .st-import-drawer[hidden] { display: none; }
.st-save-input {
  padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.32);
  background: #090f17; color: #f8fafc; font-size: 12px; font-weight: 600; width: 168px;
}
.st-viz-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.st-viz-card, .st-timeline-card {
  padding: 10px 12px; border-radius: 10px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex; flex-direction: column; gap: 8px;
}
.st-viz-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.st-timeline-meta, .st-inspector-head {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 11px; color: #cbd5e1; font-weight: 600;
}
.st-canvas { width: 100%; height: clamp(130px, 18vh, 210px); border-radius: 6px; display: block; }
.st-quick-strip {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 10px; border-radius: 8px; background: rgba(9, 15, 23, 0.72); border: 1px solid rgba(148, 163, 184, 0.16);
}
.st-quick-field { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; color: #cbd5e1; font-weight: 600; }
.st-quick-gain { width: 120px; accent-color: #38bdf8; }
.st-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.st-daw-grid {
  display: grid; grid-template-columns: 230px minmax(0, 1fr); border-radius: 8px; overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2); background: #090f17;
}
.st-daw-gutter { background: #0c1420; border-right: 1px solid rgba(148, 163, 184, 0.2); display: flex; flex-direction: column; }
.st-daw-gutter-head {
  height: 30px; padding: 0 10px; display: flex; align-items: center; font-size: 10px; font-weight: 800;
  letter-spacing: 0.08em; color: #64748b; border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.st-daw-row {
  height: 38px; padding: 0 8px; display: flex; align-items: center; justify-content: space-between; gap: 6px;
  cursor: pointer; border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}
.st-daw-row[data-selected="true"] { background: rgba(56, 189, 248, 0.16); border-left: 3px solid #38bdf8; padding-left: 5px; }
.st-daw-name { font-size: 12px; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.st-daw-actions { display: inline-flex; gap: 3px; flex-shrink: 0; }
.st-mini-btn {
  min-width: 22px; height: 22px; padding: 0 4px; border-radius: 5px; font-size: 10px; font-weight: 800;
  border: 1px solid rgba(148, 163, 184, 0.28); background: #131e2e; color: #e2e8f0; cursor: pointer;
}
.st-mini-btn[data-active="true"] { background: #78350f; border-color: #fbbf24; color: #fef08a; }
.st-mini-btn:disabled { opacity: 0.32; cursor: default; }
.st-daw-lane { min-width: 0; }
.st-timeline-canvas { width: 100%; display: block; touch-action: none; }
.st-tracks { display: flex; flex-direction: column; gap: 10px; }
.st-track {
  padding: 12px 14px; border-radius: 12px; background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.22); display: flex; flex-direction: column; gap: 10px;
}
.st-track[data-selected="true"] { border-color: rgba(56, 189, 248, 0.65); box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.22); }
.st-track-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
.st-name { padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.3); background: #090f17; color: #f8fafc; font-weight: 700; font-size: 13px; width: 190px; }
.st-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.st-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #cbd5e1; }
.st-field-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.st-num {
  width: 68px; padding: 2px 5px; border-radius: 5px; border: 1px solid rgba(148, 163, 184, 0.28);
  background: #090f17; color: #f8fafc; font-size: 11px; font-weight: 700; text-align: right;
}
.st-field input[type="range"] { width: 100%; accent-color: #38bdf8; }
.st-import-drawer { padding: 10px 12px; border-radius: 10px; background: #0f172a; border: 1px solid rgba(96, 165, 250, 0.4); display: flex; flex-direction: column; gap: 8px; }
.st-import-area { width: 100%; min-height: 92px; padding: 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.28); background: #090f17; color: #e2e8f0; font-family: ui-monospace, monospace; font-size: 11px; }
.st-status { font-size: 12px; color: #34d399; font-weight: 700; min-height: 16px; }
@media (max-width: 720px) { .st-viz-row { grid-template-columns: 1fr; } .st-daw-grid { grid-template-columns: 185px minmax(0, 1fr); } }
`;

export function ensureStudioStyles(): void {
  if (document.getElementById("ow-sound-studio-css")) return;
  const style = document.createElement("style");
  style.id = "ow-sound-studio-css";
  style.textContent = STUDIO_CSS;
  document.head.appendChild(style);
}
