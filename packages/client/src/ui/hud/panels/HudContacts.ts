/** Renders the HTML contacts list and opens direct-message composition from a row. */
import type { ContactData } from "../../../ui/widgets/hud/social/contactRows.js";
import { contactRowViews } from "../../../ui/widgets/hud/social/contactRows.js";
import { createHudPanelHeader } from "../styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class HudContacts {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private signature = "";

  constructor(startDm: (name: string) => void, close: () => void) {
    this.element = createHudTemplate<HTMLElement>("hud-contacts-template");
    this.list = requireHudElement(this.element, "[data-hud-contacts-list]");
    this.element.replaceChildren(createHudPanelHeader("Contacts", close), this.list);
    this.startDm = startDm;
  }

  update(contacts: readonly ContactData[]): void {
    const signature = JSON.stringify(contacts);
    if (signature === this.signature) return;
    this.signature = signature;
    const rows: HTMLElement[] = contactRowViews(contacts).map((contact) => this.createRow(contact));
    if (rows.length === 0) {
      const empty = createHudTemplate<HTMLElement>("hud-empty-template");
      empty.textContent = "No contacts yet — hold F near someone.";
      rows.push(empty);
    }
    this.list.replaceChildren(...rows);
  }

  private createRow(contact: ReturnType<typeof contactRowViews>[number]): HTMLDivElement {
    const row = createHudTemplate<HTMLDivElement>("hud-contact-row-template");
    const name = requireHudElement(row, "[data-hud-contact-name]");
    const presence = requireHudElement(row, "[data-hud-contact-presence]");
    const button = requireHudElement<HTMLButtonElement>(row, "[data-hud-contact-message]");
    name.textContent = contact.name;
    presence.textContent = contact.online ? "online" : "offline";
    row.dataset.online = String(contact.online);
    button.addEventListener("click", () => this.startDm(contact.name));
    return row;
  }

  private readonly startDm: (name: string) => void;
}
