/** Renderer-neutral blocking prompt shown when the server rejects this client protocol. */

const OVERLAY_ID = "dc2d-version-refresh";

function createOverlayRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = OVERLAY_ID;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:1000000",
    "display:grid",
    "place-items:center",
    "padding:24px",
    "background:rgba(8,8,14,.92)",
    "color:#e8e8ee",
    "font-family:monogram,monospace",
  ].join(";");
  return root;
}

function createPanel(message: string): HTMLDivElement {
  const panel = document.createElement("div");
  panel.style.cssText = [
    "width:min(460px,100%)",
    "padding:24px",
    "border:1px solid #ffd23d",
    "background:#1a1a24",
    "text-align:center",
    "box-shadow:0 18px 60px rgba(0,0,0,.55)",
  ].join(";");

  panel.append(createPanelTitle(), createPanelDetail(message), createRefreshButton());
  return panel;
}

function createPanelTitle(): HTMLHeadingElement {
  const title = document.createElement("h1");
  title.textContent = "Update required";
  title.style.cssText = "margin:0 0 12px;color:#ffd23d;font-size:24px";
  return title;
}

function createPanelDetail(message: string): HTMLParagraphElement {
  const detail = document.createElement("p");
  detail.textContent = message || "The dungeon changed while this page was open.";
  detail.style.cssText = "margin:0 0 18px;line-height:1.45";
  return detail;
}

function createRefreshButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Refresh game";
  button.style.cssText = [
    "padding:10px 18px",
    "border:1px solid #ffd23d",
    "background:#242432",
    "color:#ffd23d",
    "font:inherit",
    "cursor:pointer",
  ].join(";");
  button.addEventListener("click", () => window.location.reload());
  return button;
}

export function showVersionRefreshOverlay(message: string): void {
  if (document.getElementById(OVERLAY_ID)) return;
  const root = createOverlayRoot();
  const panel = createPanel(message);
  root.append(panel);
  document.body.append(root);
  panel.querySelector("button")?.focus();
}

export function bindVersionRefreshOverlay(
  connection: { onUpdateRequired: ((message: string) => void) | null },
): void {
  connection.onUpdateRequired = showVersionRefreshOverlay;
}
