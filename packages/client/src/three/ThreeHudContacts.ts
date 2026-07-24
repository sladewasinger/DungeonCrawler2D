/** Renders the HTML contacts list and opens direct-message composition from a row. */
import type { ContactData } from "../ui/widgets/hud/contactRows.js";
import { contactRowViews } from "../ui/widgets/hud/contactRows.js";
import { HUD_MUTED, HUD_PANEL, createHudButton, createHudTitle } from "./ThreeHudStyles.js";

export class ThreeHudContacts {
  readonly element = document.createElement("div");
  private readonly list = document.createElement("div");
  private signature = "";

  constructor(startDm: (name: string) => void) {
    this.element.style.cssText =
      `${HUD_PANEL};display:grid;grid-template-rows:auto 1fr;gap:5px`;
    this.list.style.cssText =
      "min-height:0;overflow-y:auto;display:grid;align-content:start;gap:5px";
    this.element.append(createHudTitle("Contacts"), this.list);
    this.startDm = startDm;
  }

  update(contacts: readonly ContactData[]): void {
    const signature = JSON.stringify(contacts);
    if (signature === this.signature) return;
    this.signature = signature;
    const rows = contactRowViews(contacts).map((contact) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px";
      const dot = document.createElement("span");
      dot.textContent = "●";
      dot.style.color = contact.online ? "#4ade80" : HUD_MUTED;
      row.append(
        dot,
        document.createTextNode(contact.name),
        createHudButton("DM", () => this.startDm(contact.name)),
      );
      return row;
    });
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No contacts yet — hold F near someone.";
      empty.style.color = HUD_MUTED;
      rows.push(empty);
    }
    this.list.replaceChildren(...rows);
  }

  private readonly startDm: (name: string) => void;
}
