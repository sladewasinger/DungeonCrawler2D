/** Coordinates contacts, craft, and stash windows without bloating the HUD facade. */
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import type { HudWindowManager } from "./HudWindows.js";
import type { ThreeHudNotices } from "./ThreeHudNotices.js";
import type { ThreeHudPanels } from "./ThreeHudPanels.js";

export class ThreeHudOverlays {
  constructor(
    private readonly manager: HudWindowManager,
    private readonly panels: ThreeHudPanels,
    private readonly focusGame: () => void,
    private readonly releaseStash: () => void,
  ) {}

  toggleChat(): void { this.toggleWindow("three-chat"); }
  toggleContacts(): void { this.toggleWindow("three-contacts"); }
  closeContacts(): void { this.manager.setVisible("three-contacts", false); }

  toggleCraft(): void {
    const opening = !this.craftOpen();
    if (opening) this.closeStash();
    this.manager.setVisible("three-craft", opening);
  }

  closeCraft(): void { this.manager.setVisible("three-craft", false); }
  craftOpen(): boolean { return this.manager.isVisible("three-craft"); }
  openStash(): void { this.manager.setVisible("three-stash", true); }

  toggleStash(): boolean {
    const opening = !this.stashOpen();
    if (opening) this.closeCraft();
    this.manager.setVisible("three-stash", opening);
    return opening;
  }

  closeStash(): void {
    this.manager.setVisible("three-stash", false);
    this.releaseStash();
  }
  stashOpen(): boolean { return this.manager.isVisible("three-stash"); }

  closeAll(): boolean {
    const wasOpen = this.craftOpen() || this.stashOpen() ||
      this.manager.isVisible("three-contacts");
    this.closeCraft();
    this.closeStash();
    this.closeContacts();
    if (wasOpen) this.focusGame();
    return wasOpen;
  }

  update(snapshot: HudFakeSnapshot, notices: ThreeHudNotices): void {
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
