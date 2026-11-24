/** Styles for the pre-title startup loading overlay matching the dark-gold overworld theme. */

const LOADING_CSS = `
.ow-loading-backdrop {
  position: fixed; inset: 0; z-index: 95;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  background: radial-gradient(circle at 50% 40%, #15202e 0%, #0d131a 72%);
  color: #f8fafc;
  opacity: 1;
  transition: opacity 220ms ease-out;
}
.ow-loading-backdrop.ow-loading-done {
  opacity: 0;
  pointer-events: none;
}
.ow-loading-card {
  width: min(440px, 100%);
  padding: 26px 26px 22px;
  border-radius: 16px;
  background: rgba(12, 18, 26, 0.94);
  border: 1px solid rgba(251, 191, 36, 0.42);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
  display: flex; flex-direction: column; gap: 14px;
  text-align: center;
}
.ow-loading-title {
  margin: 0;
  font-size: clamp(22px, 4.4vw, 28px);
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffd23d;
  text-shadow: 0 2px 12px rgba(245, 158, 11, 0.35);
}
.ow-loading-sub {
  margin: -6px 0 2px;
  font-size: 12px;
  color: #94a3b8;
  letter-spacing: 0.05em;
}
.ow-loading-track {
  position: relative;
  width: 100%; height: 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.28);
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.65);
}
.ow-loading-fill {
  height: 100%;
  width: 0%;
  border-radius: 999px;
  background: linear-gradient(90deg, #b45309 0%, #f59e0b 55%, #fde047 100%);
  box-shadow: 0 0 14px rgba(251, 191, 36, 0.55);
  transition: width 140ms ease-out;
}
@keyframes ow-loading-slide {
  0% { transform: translateX(-110%); }
  100% { transform: translateX(350%); }
}
.ow-loading-fill.ow-loading-indeterminate {
  width: 30%;
  transition: none;
  animation: ow-loading-slide 1.15s ease-in-out infinite;
}
.ow-loading-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #cbd5e1;
}
.ow-loading-status {
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ow-loading-pct {
  flex-shrink: 0;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #fbbf24;
}
`;

export function ensureLoadingStyles(): void {
  if (document.getElementById("ow-loading-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-loading-styles";
  style.textContent = LOADING_CSS;
  document.head.appendChild(style);
}
