import type { Connection } from "../net/connection";
import { stashNearby, tableNearby } from "./queries";

/**
 * Open/closed state for the range-gated modal panels (crafting table,
 * stash chest). While a panel is open, number keys act on it instead
 * of the hotbar.
 */
export class Panels {
  craftOpen = false;
  stashOpen = false;

  toggleCraft(conn: Connection): void {
    this.craftOpen = !this.craftOpen && tableNearby(conn);
  }

  /** [E] near a stash both interacts (server sends contents) and opens the panel. */
  openStashIfNearby(conn: Connection): void {
    if (stashNearby(conn) && !this.stashOpen) this.stashOpen = true;
  }

  closeAll(conn: Connection): void {
    this.craftOpen = false;
    this.stashOpen = false;
    conn.stash = null;
  }

  /**
   * Range-gated panels close for real when you walk away — otherwise
   * the number keys stay hijacked by a dialog you can't see.
   */
  sync(conn: Connection): void {
    if (this.craftOpen && !tableNearby(conn)) this.craftOpen = false;
    if (this.stashOpen && !stashNearby(conn)) {
      this.stashOpen = false;
      conn.stash = null;
    }
  }
}
