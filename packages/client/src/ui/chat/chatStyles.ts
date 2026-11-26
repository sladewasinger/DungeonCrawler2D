/** Compact CSS for proximity chat feed, input bar, and mobile chat button. */

const CHAT_CSS = `
.ow-chat-ui {
  position: fixed; left: max(12px, env(safe-area-inset-left));
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--ow-slot-size) + 46px);
  z-index: 44; width: min(300px, calc(100vw - 28px));
  display: flex; flex-direction: column; gap: 6px; pointer-events: none;
}
.ow-chat-feed {
  display: flex; flex-direction: column; gap: 3px;
}
.ow-chat-line {
  align-self: flex-start; max-width: 100%; padding: 4px 8px; border-radius: 8px;
  font-size: 12px; line-height: 1.3; word-break: break-word;
  background: rgba(12, 18, 26, 0.82); border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0; backdrop-filter: blur(6px);
  transition: opacity 350ms ease;
}
.ow-chat-line[data-shout="true"] { border-color: rgba(251, 191, 36, 0.6); color: #fef08a; }
.ow-chat-line-name { font-weight: 800; color: #7dd3fc; margin-right: 4px; }
.ow-chat-line[data-shout="true"] .ow-chat-line-name { color: #fbbf24; }
.ow-chat-bar {
  display: flex; align-items: center; gap: 5px; pointer-events: auto;
}
.ow-chat-bar[hidden] { display: none; }
.ow-chat-input {
  flex: 1; min-width: 0; padding: 6px 10px; border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(12, 18, 26, 0.92);
  color: #f8fafc; font-size: 12px; outline: none;
}
.ow-chat-input:focus { border-color: #38bdf8; }
.ow-chat-shout-btn, .ow-chat-toggle-btn {
  padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 800;
  border: 1px solid rgba(148, 163, 184, 0.32); background: rgba(15, 23, 42, 0.88);
  color: #cbd5e1; cursor: pointer; pointer-events: auto;
}
.ow-chat-shout-btn[data-active="true"] { border-color: #fbbf24; color: #fef08a; background: rgba(120, 53, 15, 0.72); }
.ow-chat-toggle-btn { align-self: flex-start; }
@media (hover: none), (pointer: coarse), (max-width: 900px) {
  .ow-chat-ui {
    left: max(26px, env(safe-area-inset-left));
    bottom: calc(env(safe-area-inset-bottom) + var(--ow-slot-size) + 46px);
  }
}
`;

export function ensureChatStyles(): void {
  if (document.getElementById("ow-proximity-chat-styles")) return;
  const style = document.createElement("style");
  style.id = "ow-proximity-chat-styles";
  style.textContent = CHAT_CSS;
  document.head.appendChild(style);
}
