/** Coordinates exclusive HUD modals so opening one cleanly closes any active modal. */

export type ModalId = "inventory" | "crafting" | "character" | "chest" | "minimap" | "settings" | "chat";

export interface ModalEntry {
  readonly isOpen: () => boolean;
  readonly open: () => void;
  readonly close: () => void;
}

export class ModalRouter {
  private readonly entries = new Map<ModalId, ModalEntry>();

  register(id: ModalId, entry: ModalEntry): void {
    this.entries.set(id, entry);
  }

  activeModal(): ModalId | null {
    for (const [id, entry] of this.entries) {
      if (entry.isOpen()) return id;
    }
    return null;
  }

  isAnyOpen(): boolean {
    return this.activeModal() !== null;
  }

  open(id: ModalId): void {
    const target = this.entries.get(id);
    if (!target) return;
    this.closeAllExcept(id);
    if (!target.isOpen()) target.open();
  }

  close(id: ModalId): boolean {
    const entry = this.entries.get(id);
    if (!entry || !entry.isOpen()) return false;
    entry.close();
    return true;
  }

  toggle(id: ModalId): boolean {
    const target = this.entries.get(id);
    if (!target) return false;
    if (target.isOpen()) {
      target.close();
      return false;
    }
    this.open(id);
    return true;
  }

  closeAll(): boolean {
    let closed = false;
    for (const entry of this.entries.values()) {
      if (!entry.isOpen()) continue;
      entry.close();
      closed = true;
    }
    return closed;
  }

  private closeAllExcept(keep: ModalId): void {
    for (const [id, entry] of this.entries) {
      if (id !== keep && entry.isOpen()) entry.close();
    }
  }
}
