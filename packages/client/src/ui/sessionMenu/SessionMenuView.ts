import type { AdvancedSettingsDialog } from "./AdvancedSettingsDialog.js";


interface SessionMenuViewOptions {
  gear: HTMLButtonElement;

  overlay: HTMLDivElement;

  card: HTMLElement;

  primary: HTMLDivElement;

  confirmation: HTMLDivElement;

  advanced: AdvancedSettingsDialog;

  onOutsideClick: () => void;

}

export function configureSessionMenuView({ gear, overlay, card, primary, confirmation, advanced, onOutsideClick }: SessionMenuViewOptions): void {
  gear.setAttribute("aria-label", "Game menu");

  gear.setAttribute("aria-expanded", "false");

  gear.style.cssText = "position:absolute;right:12px;top:12px;z-index:2501;width:40px;height:40px;border:1px solid #71758b;background:rgba(18,19,30,.84);color:#f3f0e9;font:20px sans-serif;pointer-events:auto;cursor:pointer";

  overlay.dataset.sessionMenu = "true";

  overlay.setAttribute("role", "dialog");

  overlay.setAttribute("aria-modal", "true");

  overlay.setAttribute("aria-label", "Game menu");

  overlay.style.cssText = "position:absolute;inset:0;z-index:2500;display:none;place-items:center;padding:16px;box-sizing:border-box;background:rgba(6,7,12,.76);pointer-events:auto;text-shadow:none";

  card.style.cssText = "width:min(92vw,420px);max-height:min(88vh,680px);overflow-y:auto;padding:18px;box-sizing:border-box;background:rgba(17,18,29,.98);border:1px solid #686d86;box-shadow:0 18px 60px rgba(0,0,0,.68);color:#f2f0eb;font:12px monospace";

  primary.style.cssText = "display:grid;gap:9px";

  confirmation.style.cssText = "display:none;gap:10px";

  card.append(primary, confirmation, advanced.element);

  overlay.append(card);

  overlay.addEventListener("pointerdown", (event) => { if (event.target === overlay) onOutsideClick();

});

}
