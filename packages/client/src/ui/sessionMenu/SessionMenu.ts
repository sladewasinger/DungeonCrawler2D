/** Owns the shared non-pausing game menu, confirmations, and local settings controls. */
import {
  LocalPresentationController,
} from "./localPresentation.js";
import { AdvancedSettingsDialog } from "./AdvancedSettingsDialog.js";
import { createSessionButton } from "./SessionMenuControls.js";
import {
  quitConfirmation,
  respawnConfirmation,
  showSessionMenuConfirmation,
  type SessionMenuConfirmation,
} from "./SessionMenuConfirmation.js";
import { SessionMenuFocus } from "./SessionMenuFocus.js";
import {
  buildSessionMenuPrimary,
  createRespawnButton,
} from "./SessionMenuPrimary.js";

export interface SessionMenuActions {
  focusGame(): void;
  respawn(): void;
  quitToTitle(): void;
  replayTutorials?(): void;
}

interface InternalSessionMenuActions extends SessionMenuActions {
  beforeOpen?(): void;
  onOpenChange?(open: boolean): void;
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
  private readonly advanced: AdvancedSettingsDialog;
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
    this.advanced = new AdvancedSettingsDialog({
      presentation: this.presentation,
      replayTutorials: actions.replayTutorials,
      onBack: () => this.closeAdvanced(),
    });
    this.configureGear();
    this.configureOverlay();
    this.focus = new SessionMenuFocus(
      appRoot,
      hudRoot,
      this.overlay,
      () => this.activeFocusables(),
    );
    this.respawnButton = createRespawnButton(() => this.confirm(
      respawnConfirmation(() => {
        this.close(false);
        this.actions.respawn();
      }),
    ));
    this.resumeButton = buildSessionMenuPrimary({
      container: this.primary,
      respawnButton: this.respawnButton,
      settingsContent,
      onResume: () => this.close(),
      onAdvanced: () => this.openAdvanced(),
      onQuit: () => this.confirm(quitConfirmation(
        () => this.actions.quitToTitle(),
      )),
    });
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
    this.advanced.close();
    this.card.style.width = "min(92vw,420px)";
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
    this.advanced.close();
    this.card.style.width = "min(92vw,420px)";
    this.gear.setAttribute("aria-expanded", "false");
    this.confirmationReturnFocus = undefined;
    this.focus.deactivate(false, this.actions.focusGame);
    if (focus) this.actions.focusGame();
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
    this.card.append(this.primary, this.confirmation, this.advanced.element);
    this.overlay.append(this.card);
    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay) this.close();
    });
  }

  private openAdvanced(): void {
    this.primary.style.display = "none";
    this.confirmation.style.display = "none";
    this.card.style.width = "min(96vw,720px)";
    this.advanced.open();
  }

  private closeAdvanced(): void {
    this.advanced.close();
    this.card.style.width = "min(92vw,420px)";
    this.primary.style.display = "grid";
    this.resumeButton?.focus({ preventScroll: true });
  }

  private confirm(value: SessionMenuConfirmation): void {
    this.confirmationReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
    const cancel = showSessionMenuConfirmation({
      container: this.confirmation,
      primary: this.primary,
      value,
      returnFocus: this.confirmationReturnFocus,
      fallbackFocus: this.resumeButton,
    });
    cancel.focus();
  }

  private activeFocusables(): HTMLElement[] {
    const container = this.advanced.isOpen
      ? this.advanced.element
      : this.confirmation.style.display === "grid"
        ? this.confirmation
        : this.primary;
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) =>
        !element.hidden &&
        element.tabIndex >= 0 &&
        element.getClientRects().length > 0);
  }
}
