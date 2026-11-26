/** Styles for Hub NPC modals (Merchant, Blacksmith, Bounty Board, Guide, Stash), Gold pills, and Bounty HUD. */

const HUB_CSS = `
.ow-gold-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 800;
  color: #fde047; background: rgba(120, 53, 15, 0.72); border: 1px solid rgba(250, 204, 21, 0.45);
  white-space: nowrap;
}
.ow-slot-upgrade {
  position: absolute; left: 3px; top: 2px; padding: 0 3px; border-radius: 4px;
  font-size: 9px; font-weight: 900; color: #86efac; background: rgba(5, 46, 22, 0.88);
  border: 1px solid rgba(74, 222, 128, 0.55); pointer-events: none;
}
.ow-hub-modal {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(560px, 94vw); max-height: 84dvh; z-index: 64;
  display: flex; flex-direction: column; overflow: hidden;
}
.ow-hub-modal[hidden] { display: none; }
.ow-hub-scroll {
  overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;
}
.ow-hub-tabs { display: flex; gap: 6px; padding: 6px 14px 0; flex-wrap: wrap; }
.ow-hub-tab[data-active="true"] {
  background: rgba(251, 191, 36, 0.25); border-color: rgba(251, 191, 36, 0.85); color: #fef08a;
}
.ow-hub-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; border-radius: 10px;
  background: rgba(15, 23, 42, 0.84); border: 1px solid rgba(148, 163, 184, 0.22);
}
.ow-hub-meta { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.ow-hub-icon { width: 28px; height: 28px; image-rendering: pixelated; flex: 0 0 auto; }
.ow-hub-text { display: flex; flex-direction: column; min-width: 0; }
.ow-hub-title { font-size: 12px; font-weight: 700; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ow-hub-sub { font-size: 10px; color: #cbd5e1; line-height: 1.3; }
.ow-hub-notice {
  margin: 6px 14px 0; padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 700;
  color: #fde68a; background: rgba(120, 53, 15, 0.72); border: 1px solid rgba(251, 191, 36, 0.55);
}
.ow-hub-notice[hidden] { display: none; }
.ow-hub-btn {
  padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;
  color: #f8fafc; background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(148, 163, 184, 0.38);
  white-space: nowrap; flex: 0 0 auto;
}
.ow-hub-btn:hover { border-color: #fde047; color: #fef08a; }
.ow-bounty-hud {
  position: fixed; right: 12px; top: 86px; z-index: 36;
  max-width: min(230px, 46vw); padding: 6px 9px; border-radius: 10px;
  background: rgba(12, 18, 26, 0.8); border: 1px solid rgba(148, 163, 184, 0.25);
  color: #e2e8f0; font-size: 10px; display: flex; flex-direction: column; gap: 3px;
}
.ow-bounty-hud[hidden] { display: none; }
.ow-bounty-hud-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-weight: 800; color: #fde047; }
.ow-bounty-hud-line { display: flex; justify-content: space-between; gap: 8px; white-space: nowrap; }
@media (max-width: 640px) {
  .ow-hub-modal { width: 95vw; max-height: 82dvh; }
  .ow-hub-row { flex-wrap: wrap; }
  .ow-bounty-hud { top: 68px; right: 8px; font-size: 9px; max-width: 175px; }
}
`;

let injected = false;
export function ensureHubStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = HUB_CSS;
  document.head.append(style);
}
