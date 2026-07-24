/** Owns the shared non-pausing game menu, confirmations, and local settings controls. */
import {
  LocalPresentationController,
  MAX_BRIGHTNESS,
  MAX_FONT_SCALE,
  MIN_BRIGHTNESS,
  MIN_FONT_SCALE,
} from "./localPresentation.js";
import {
  createSessionButton,
  createSessionRange,
} from "./SessionMenuControls.js";

export interface SessionMenuActions {
  focusGame(): void;
  respawn(): void;
  quitToTitle(): void;
}

interface Confirmation {
  title: string;
  detail: string;
  actionLabel: string;
  action: () => void;
}

export class SessionMenu {
  private readonly gear = createSessionButton("⚙", () => this.toggle());
  private readonly overlay = document.createElement("div");
  private readonly card = document.createElement("section");
  private readonly primary = document.createElement("div");
  private readonly confirmation = document.createElement("div");
  private readonly respawnButton: HTMLButtonElement;
  private readonly presentation: LocalPresentationController;
  private openState = false;

  constructor(
    appRoot: HTMLElement,
    hudRoot: HTMLElement,
    settingsContent: HTMLElement,
    private readonly actions: SessionMenuActions,
  ) {
    this.presentation = new LocalPresentationController(appRoot, hudRoot);
    this.configureGear();
    this.configureOverlay();
    this.respawnButton = createSessionButton("Respawn (die)", () => this.confirm({
      title: "Respawn?",
      detail: "This kills your crawler. You will lose your current position.",
      actionLabel: "Confirm respawn",
      action: () => {
        this.close(false);
        this.actions.respawn();
      },
    }));
    this.buildPrimary(settingsContent);
    hudRoot.append(this.gear, this.overlay);
  }

  update(canRespawn: boolean): void {
    this.respawnButton.disabled = !canRespawn;
    this.respawnButton.style.opacity = canRespawn ? "1" : ".45";
    this.respawnButton.title = canRespawn ? "" : "Waiting to respawn";
  }

  isOpen(): boolean {
    return this.openState;
  }

  toggle(): void {
    if (this.openState) this.close();
    else this.open();
  }

  open(): void {
    this.openState = true;
    this.confirmation.replaceChildren();
    this.primary.style.display = "grid";
    this.confirmation.style.display = "none";
    this.overlay.style.display = "grid";
    this.gear.setAttribute("aria-expanded", "true");
  }

  close(focus = true): void {
    if (!this.openState) return;
    this.openState = false;
    this.overlay.style.display = "none";
    this.gear.setAttribute("aria-expanded", "false");
    if (focus) this.actions.focusGame();
  }

  dispose(): void {
    this.presentation.dispose();
    this.gear.remove();
    this.overlay.remove();
  }

  private configureGear(): void {
    this.gear.setAttribute("aria-label", "Game menu");
    this.gear.setAttribute("aria-expanded", "false");
    this.gear.style.cssText =
      "position:absolute;right:12px;top:12px;z-index:2501;width:40px;height:40px;" +
      "border:1px solid #71758b;background:rgba(18,19,30,.84);color:#f3f0e9;" +
      "font:20px sans-serif;pointer-events:auto;cursor:pointer";
  }

  private configureOverlay(): void {
    this.overlay.dataset.sessionMenu = "true";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.overlay.setAttribute("aria-label", "Game menu");
    this.overlay.style.cssText =
      "position:absolute;inset:0;z-index:2500;display:none;place-items:center;" +
      "padding:16px;box-sizing:border-box;background:rgba(6,7,12,.76);" +
      "pointer-events:auto;text-shadow:none";
    this.card.style.cssText =
      "width:min(92vw,420px);max-height:min(88vh,680px);overflow-y:auto;" +
      "padding:18px;box-sizing:border-box;background:rgba(17,18,29,.98);" +
      "border:1px solid #686d86;box-shadow:0 18px 60px rgba(0,0,0,.68);" +
      "color:#f2f0eb;font:12px monospace";
    this.primary.style.cssText = "display:grid;gap:9px";
    this.confirmation.style.cssText = "display:none;gap:10px";
    this.card.append(this.primary, this.confirmation);
    this.overlay.append(this.card);
    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay) this.close();
    });
  }

  private buildPrimary(settingsContent: HTMLElement): void {
    const title = document.createElement("h2");
    title.textContent = "Game menu";
    title.style.cssText = "margin:0 0 4px;color:#ffd54c;font-size:20px";
    const resume = createSessionButton("Resume", () => this.close());
    const quit = createSessionButton("Quit to opening screen", () => this.confirm({
      title: "Quit to opening screen?",
      detail: "Your crawler disconnects before the opening screen returns.",
      actionLabel: "Confirm quit",
      action: () => this.actions.quitToTitle(),
    }));
    this.primary.append(title, resume, this.respawnButton, quit, ...this.accessibilityControls(), settingsContent);
  }

  private accessibilityControls(): HTMLElement[] {
    const localTitle = document.createElement("h3");
    localTitle.textContent = "Accessibility";
    localTitle.style.cssText = "margin:8px 0 0;color:#aaaec8;font-size:12px";
    const current = this.presentation.current();
    const brightness = createSessionRange(
      "World brightness",
      MIN_BRIGHTNESS,
      MAX_BRIGHTNESS,
      current.brightness,
      (value) => this.presentation.setBrightness(value),
    );
    const font = createSessionRange(
      "HUD font scale",
      MIN_FONT_SCALE,
      MAX_FONT_SCALE,
      current.fontScale,
      (value) => this.presentation.setFontScale(value),
    );
    const hudTitle = document.createElement("h3");
    hudTitle.textContent = "HUD & view";
    hudTitle.style.cssText = "margin:8px 0 0;color:#aaaec8;font-size:12px";
    return [localTitle, brightness, font, hudTitle];
  }

  private confirm(value: Confirmation): void {
    const title = document.createElement("h2");
    title.textContent = value.title;
    title.style.cssText = "margin:0;color:#ffd54c;font-size:18px";
    const detail = document.createElement("p");
    detail.textContent = value.detail;
    detail.style.cssText = "margin:0;line-height:1.45;color:#d8d5df";
    const confirm = createSessionButton(value.actionLabel, value.action);
    confirm.style.borderColor = "#c45d65";
    const cancel = createSessionButton("Cancel", () => {
      this.confirmation.style.display = "none";
      this.primary.style.display = "grid";
    });
    this.confirmation.replaceChildren(title, detail, confirm, cancel);
    this.primary.style.display = "none";
    this.confirmation.style.display = "grid";
    cancel.focus();
  }
}
