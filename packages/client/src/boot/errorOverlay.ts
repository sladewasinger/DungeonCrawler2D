// Boot-error overlay: last-resort visible failure for an otherwise-silent black
// screen — installs window error/unhandledrejection listeners that render the
// failure into a plain DOM div instead of leaving a blank canvas.
const OVERLAY_ID = "dc2d-boot-error";

function ensureOverlay(): HTMLDivElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing instanceof HTMLDivElement) return existing;
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "999999",
    background: "#1a0a0aee",
    color: "#ffb4b4",
    font: "13px/1.5 monospace",
    padding: "20px",
    whiteSpace: "pre-wrap",
    overflow: "auto",
    boxSizing: "border-box",
  });
  document.body.append(el);
  return el;
}

/** Full stack in dev (the developer needs to see it); a short generic line in prod (no internals on-screen for players). */
function describeError(reason: unknown, verbose: boolean): string {
  if (!verbose) return "Something went wrong loading the game. Please reload.";
  if (reason instanceof Error) return reason.stack ?? reason.message;
  return String(reason);
}

function appendMessage(source: string, reason: unknown, verbose: boolean): void {
  const el = ensureOverlay();
  el.textContent += `[boot error: ${source}]\n${describeError(reason, verbose)}\n\n`;
  console.error(`[boot-error] ${source}`, reason);
}

/** Installs window error/unhandledrejection listeners so a boot failure always renders a visible message — a black screen must never be silent. */
export function installBootErrorOverlay(verbose: boolean): void {
  window.addEventListener("error", (event) => appendMessage("error", event.error ?? event.message, verbose));
  window.addEventListener("unhandledrejection", (event) => appendMessage("unhandledrejection", event.reason, verbose));
}
