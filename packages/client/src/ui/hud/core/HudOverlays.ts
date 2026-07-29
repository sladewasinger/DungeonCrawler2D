/** Coordinates contacts, craft, and stash windows without bloating the HUD facade. */
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import type { HudNotices } from "../feedback/HudNotices.js";
import type { HudPanels } from "./HudPanels.js";

const CHAT_WINDOW = "three-chat";
const CONTACTS_WINDOW = "three-contacts";
const CRAFT_WINDOW = "three-craft";
const STASH_WINDOW = "three-stash";

interface HudOverlayOptions {
  readonly manager: HudWindowManager;
  readonly panels: HudPanels;
  readonly focusGame: () => void;
  readonly releaseStash: () => void;
}

export class HudOverlays {
  private readonly manager: HudWindowManager;
  private readonly panels: HudPanels;
  private readonly focusGame: () => void;
  private readonly releaseStash: () => void;

  constructor({ manager, panels, focusGame, releaseStash }: HudOverlayOptions) {
    this.manager = manager;
    this.panels = panels;
    this.focusGame = focusGame;
    this.releaseStash = releaseStash;
  }

  toggleChat(): void { this.toggleWindow(CHAT_WINDOW); }
  toggleContacts(): void { this.toggleWindow(CONTACTS_WINDOW); }
  closeContacts(): void { this.manager.setVisible(CONTACTS_WINDOW, false); }

  toggleCraft(): void {
    const opening = !this.craftOpen();
    if (opening) this.closeStash();
    this.manager.setVisible(CRAFT_WINDOW, opening);
  }

  closeCraft(): void { this.manager.setVisible(CRAFT_WINDOW, false); }
  craftOpen(): boolean { return this.manager.isVisible(CRAFT_WINDOW); }
  openStash(): void { this.manager.setVisible(STASH_WINDOW, true); }

  toggleStash(): boolean {
    const opening = !this.stashOpen();
    if (opening) this.closeCraft();
    this.manager.setVisible(STASH_WINDOW, opening);
    return opening;
  }

  closeStash(): void {
    this.manager.setVisible(STASH_WINDOW, false);
    this.releaseStash();
  }
  stashOpen(): boolean { return this.manager.isVisible("three-stash"); }

  closeAll(): boolean {
    const wasOpen = this.craftOpen() || this.stashOpen() ||
      this.manager.isVisible(CONTACTS_WINDOW);
    this.closeCraft();
    this.closeStash();
    this.closeContacts();
    if (wasOpen) this.focusGame();
    return wasOpen;
  }

  update(snapshot: HudFakeSnapshot, notices: HudNotices): void {
    this.panels.contacts.update(snapshot.contacts);
    this.panels.craft.update(snapshot.craft);
    this.panels.stash.update(snapshot.stash);
    notices.update(snapshot, performance.now());
    if (!snapshot.craft.nearby) this.closeCraft();
    if (!snapshot.stash.nearby) this.closeStash();
  }

  private toggleWindow(id: string): void {
    this.manager.setVisible(id, !this.manager.isVisible(id));
  }
}
