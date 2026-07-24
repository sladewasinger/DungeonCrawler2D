/** Owns the shared non-pausing game menu, confirmations, and local settings controls. */
import {
  LocalPresentationController,
} from "./localPresentation.js";
import {
  createAccessibilityControls,
  createSessionButton,
} from "./SessionMenuControls.js";
import { SessionMenuFocus } from "./SessionMenuFocus.js";

export interface SessionMenuActions {
  focusGame(): void;
  respawn(): void;
  quitToTitle(): void;
}

interface InternalSessionMenuActions extends SessionMenuActions {
  beforeOpen?(): void;
  onOpenChange?(open: boolean): void;
}

interface Confirmation {
  title: string;
  detail: string;
  actionLabel: string;
  action: () => void;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export class SessionMenu {
  private readonly gear = createSessionButton("⚙", () => this.toggle());
  private readonly overlay = document.createElement("div");
  private readonly card = document.createElement("section");
  private readonly primary = document.createElement("div");
  private readonly confirmation = document.createElement("div");
  private readonly respawnButton: HTMLButtonElement;
  private resumeButton: HTMLButtonElement | undefined;
  private readonly presentation: LocalPresentationController;
  private readonly focus: SessionMenuFocus;
  private confirmationReturnFocus: HTMLElement | undefined;
  private openState = false;

  constructor(
    appRoot: HTMLElement,
    hudRoot: HTMLElement,
    settingsContent: HTMLElement,
    private readonly actions: InternalSessionMenuActions,
  ) {
    this.presentation = new LocalPresentationController(appRoot, hudRoot);
    this.configureGear();
    this.configureOverlay();
    this.focus = new SessionMenuFocus(
      appRoot,
      hudRoot,
      this.overlay,
      () => this.activeFocusables(),
    );
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
    this.focus.remember();
    this.confirmationReturnFocus = undefined;
    this.actions.beforeOpen?.();
    this.openState = true;
    this.actions.onOpenChange?.(true);
    this.confirmation.replaceChildren();
    this.primary.style.display = "grid";
    this.confirmation.style.display = "none";
    this.overlay.style.display = "grid";
    this.gear.setAttribute("aria-expanded", "true");
    this.focus.activate(this.resumeButton);
  }

  close(focus = true): void {
    if (!this.openState) return;
    this.openState = false;
    this.actions.onOpenChange?.(false);
    this.overlay.style.display = "none";
    this.gear.setAttribute("aria-expanded", "false");
    this.confirmationReturnFocus = undefined;
    this.focus.deactivate(focus, this.actions.focusGame);
  }

  dispose(): void {
    if (this.openState) this.actions.onOpenChange?.(false);
    this.openState = false;
    this.focus.dispose();
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
    this.resumeButton = resume;
    const quit = createSessionButton("Quit to opening screen", () => this.confirm({
      title: "Quit to opening screen?",
      detail: "Your crawler disconnects before the opening screen returns.",
      actionLabel: "Confirm quit",
      action: () => this.actions.quitToTitle(),
    }));
    this.primary.append(
      title,
      resume,
      this.respawnButton,
      quit,
      ...createAccessibilityControls(this.presentation),
      settingsContent,
    );
  }

  private confirm(value: Confirmation): void {
    this.confirmationReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
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
      const destination = this.confirmationReturnFocus?.isConnected
        ? this.confirmationReturnFocus
        : this.resumeButton;
      destination?.focus({ preventScroll: true });
    });
    this.confirmation.replaceChildren(title, detail, confirm, cancel);
    this.primary.style.display = "none";
    this.confirmation.style.display = "grid";
    cancel.focus();
  }

  private activeFocusables(): HTMLElement[] {
    const container = this.confirmation.style.display === "grid"
      ? this.confirmation
      : this.primary;
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) =>
        !element.hidden &&
        element.tabIndex >= 0 &&
        element.getClientRects().length > 0);
  }
}
