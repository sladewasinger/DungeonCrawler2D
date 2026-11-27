/** Injected CSS styles for Biome Entry Banners and Discovery/Interaction Toasts. */

const DISCOVERY_STYLE_ID = "dc2d-discovery-styles";

const CSS = `
.ow-biome-banner {
  position: fixed;
  top: 52px;
  left: 50%;
  transform: translateX(-50%) translateY(-6px);
  z-index: 42;
  pointer-events: none;
  padding: 8px 22px;
  border-radius: 10px;
  background: rgba(9, 13, 22, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  text-align: center;
  opacity: 0;
  transition: opacity 0.28s ease, transform 0.28s ease;
  font-family: "Trebuchet MS", system-ui, sans-serif;
}
.ow-biome-banner.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
.ow-biome-title { font-size: 16px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.ow-biome-sub { font-size: 11px; color: #cbd5e1; margin-top: 2px; letter-spacing: 0.04em; }

.ow-discovery-toast {
  position: fixed;
  top: 108px;
  left: 50%;
  transform: translateX(-50%) translateY(-6px);
  z-index: 43;
  pointer-events: none;
  max-width: min(380px, 88vw);
  padding: 8px 16px;
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(250, 204, 21, 0.55);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
  text-align: center;
  opacity: 0;
  transition: opacity 0.24s ease, transform 0.24s ease;
  font-family: "Trebuchet MS", system-ui, sans-serif;
}
.ow-discovery-toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
.ow-discovery-title { font-size: 13px; font-weight: 700; color: #fde047; }
.ow-discovery-sub { font-size: 11px; color: #e2e8f0; margin-top: 2px; }
`;

export function ensureDiscoveryStyles(): void {
  if (typeof document === "undefined" || document.getElementById(DISCOVERY_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DISCOVERY_STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
