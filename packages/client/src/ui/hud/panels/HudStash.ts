/** Renders the HTML two-column stash and emits put/take intents by authoritative row index. */
import type { StashSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import type { StashRowView } from "../../../ui/widgets/hud/windows/stashRows.js";
import {
  createHudButton,
  createHudPanelHeader,
} from "../styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

interface StashColumnOptions {
  readonly title: string;
  readonly rows: readonly StashRowView[];
  readonly action: string | null;
  readonly onAction?: (index: number, itemId: string) => void;
}

interface HudStashOptions {
  readonly put: (index: number) => void;
  readonly take: (index: number, itemId: string) => void;
  readonly takeAll: () => void;
  readonly close: () => void;
}

const createColumn = ({ title, rows, action, onAction }: StashColumnOptions): HTMLDivElement => {
  const column = createHudTemplate<HTMLDivElement>("hud-stash-column-template");
  requireHudElement(column, "[data-hud-stash-column-title]").textContent = title;
  const list = requireHudElement(column, "[data-hud-stash-rows]");
  appendStashRows(list, { rows, action, onAction });
  return column;
};

const appendStashRows = (
  list: Element,
  { rows, action, onAction }: {
    rows: readonly StashRowView[];
    action: string | null;
    onAction?: StashColumnOptions["onAction"];
  },
): void => {
  if (rows.length === 0) return list.append(createEmptyStashRow());
  list.append(...rows.map((item) => createStashRow(item, action, onAction)));
};

const createEmptyStashRow = (): HTMLElement => {
  const empty = createHudTemplate<HTMLElement>("hud-empty-template");
  empty.textContent = "Empty";
  return empty;
};

const createStashRow = (
  item: StashRowView,
  action: string | null,
  onAction: StashColumnOptions["onAction"],
): HTMLDivElement => {
  const row = createHudTemplate<HTMLDivElement>("hud-contact-row-template");
  requireHudElement(row, "[data-hud-contact-name]").textContent = `${item.name} ×${item.qty}`;
  requireHudElement(row, "[data-hud-contact-presence]").textContent = "";
  configureStashAction({
    button: requireHudElement<HTMLButtonElement>(row, "[data-hud-contact-message]"),
    item,
    action,
    onAction,
  });
  return row;
};

const configureStashAction = ({
  button, item, action, onAction,
}: {
  button: HTMLButtonElement;
  item: StashRowView;
  action: string | null;
  onAction: StashColumnOptions["onAction"];
}): void => {
  if (!action || !onAction) return button.remove();
  button.textContent = action;
  button.addEventListener("click", () => onAction(item.index, item.itemId));
};

export class HudStash {
  readonly element: HTMLElement;
  private signature = "";
  private readonly put: (index: number) => void;
  private readonly take: (index: number, itemId: string) => void;
  private readonly takeAll: () => void;
  private readonly close: () => void;

  constructor({ put, take, takeAll, close }: HudStashOptions) {
    this.put = put;
    this.take = take;
    this.takeAll = takeAll;
    this.close = close;
    this.element = createHudTemplate<HTMLElement>("hud-stash-template");
  }

  update(snapshot: StashSnapshot): void {
    const signature = JSON.stringify(snapshot);
    if (signature === this.signature) return;
    this.signature = signature;
    const columns = this.createColumns(snapshot);
    this.element.replaceChildren(this.createHeader(snapshot), columns);
  }

  private createColumns(snapshot: StashSnapshot): HTMLDivElement {
    const columns = createHudTemplate<HTMLDivElement>("hud-stash-columns-template");
    columns.append(
      createColumn({ title: "Inventory", rows: snapshot.inventory, action: snapshot.kind === "loot" ? null : "put", onAction: this.put }),
      createColumn({ title: snapshot.kind === "loot" ? "Loot" : "Stash", rows: snapshot.entries, action: "take", onAction: this.take }),
    );
    return columns;
  }

  private createHeader(snapshot: StashSnapshot): HTMLDivElement {
    const header = createHudPanelHeader(snapshot.kind === "loot" ? "Death Loot" : "Stash", this.close);
    if (snapshot.kind === "loot" && snapshot.entries.length > 0) header.append(createHudButton("take all", this.takeAll));
    return header;
  }
}
