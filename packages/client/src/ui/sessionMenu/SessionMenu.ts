import { LocalPresentationController } from "./localPresentation.js";
import { AdvancedSettingsDialog } from "./AdvancedSettingsDialog.js";
import { createSessionButton } from "./SessionMenuControls.js";
import { quitConfirmation, respawnConfirmation, showSessionMenuConfirmation, type SessionMenuConfirmation } from "./SessionMenuConfirmation.js";
import { SessionMenuFocus } from "./SessionMenuFocus.js";
import { configureSessionMenuView } from "./SessionMenuView.js";
import { buildSessionMenuPrimary, createRespawnButton } from "./SessionMenuPrimary.js";

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

const FOCUSABLE_SELECTOR = "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])";
const CARD_WIDTH = "min(92vw,420px)";

interface SessionMenuOptions {
  appRoot: HTMLElement;
  hudRoot: HTMLElement;
  settingsContent: HTMLElement;
  actions: InternalSessionMenuActions;
}

export class SessionMenu {
  private readonly actions: InternalSessionMenuActions;
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

  constructor({ appRoot, hudRoot, settingsContent, actions }: SessionMenuOptions) {
    this.actions = actions;
    this.presentation = new LocalPresentationController(appRoot, hudRoot);
    this.advanced = this.createAdvancedDialog(actions);
    configureSessionMenuView({ gear: this.gear, overlay: this.overlay, card: this.card, primary: this.primary, confirmation: this.confirmation, advanced: this.advanced, onOutsideClick: () => this.close() });
    this.focus = new SessionMenuFocus({ appRoot, hudRoot, overlay: this.overlay, activeFocusables: () => this.activeFocusables() });
    this.respawnButton = createRespawnButton(() => this.confirm(respawnConfirmation(() => this.respawn())));
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

  private createAdvancedDialog(actions: InternalSessionMenuActions): AdvancedSettingsDialog {
    return new AdvancedSettingsDialog({ presentation: this.presentation, replayTutorials: actions.replayTutorials, onBack: () => this.closeAdvanced() });
  }

  private respawn(): void {
    this.close(false);
    this.actions.respawn();
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
    this.card.style.width = CARD_WIDTH;
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
    this.card.style.width = CARD_WIDTH;
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

  private openAdvanced(): void {
    this.primary.style.display = "none";
    this.confirmation.style.display = "none";
    this.card.style.width = "min(96vw,720px)";
    this.advanced.open();
  }

  private closeAdvanced(): void {
    this.advanced.close();
    this.card.style.width = CARD_WIDTH;
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
