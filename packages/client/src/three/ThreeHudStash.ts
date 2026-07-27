/** Renders the HTML two-column stash and emits put/take intents by authoritative row index. */
import type { StashSnapshot } from "../ui/widgets/hud/fakeData.js";
import type { StashRowView } from "../ui/widgets/hud/stashRows.js";
import {
  HUD_MUTED,
  HUD_PANEL,
  createHudButton,
  createHudPanelHeader,
  createHudTitle,
} from "./ThreeHudStyles.js";

interface StashColumnOptions {
  readonly title: string;
  readonly rows: readonly StashRowView[];
  readonly action: string | null;
  readonly onAction?: (index: number, itemId: string) => void;
}

interface ThreeHudStashOptions {
  readonly put: (index: number) => void;
  readonly take: (index: number, itemId: string) => void;
  readonly takeAll: () => void;
  readonly close: () => void;
}

const createColumn = ({ title, rows, action, onAction }: StashColumnOptions): HTMLDivElement => {
  const column = document.createElement("div");
  column.style.cssText =
    "min-width:0;overflow-y:auto;display:grid;align-content:start;gap:5px";
  column.append(createHudTitle(title));
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Empty";
    empty.style.color = HUD_MUTED;
    column.append(empty);
  }
  for (const item of rows) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px";
    row.append(document.createTextNode(`${item.name} ×${item.qty}`));
    if (action && onAction) {
      row.append(createHudButton(action, () => onAction(item.index, item.itemId)));
    }
    column.append(row);
  }
  return column;
};

export class ThreeHudStash {
  readonly element = document.createElement("div");
  private signature = "";
  private readonly put: (index: number) => void;
  private readonly take: (index: number, itemId: string) => void;
  private readonly takeAll: () => void;
  private readonly close: () => void;

  constructor({ put, take, takeAll, close }: ThreeHudStashOptions) {
    this.put = put;
    this.take = take;
    this.takeAll = takeAll;
    this.close = close;
    this.element.style.cssText =
      `${HUD_PANEL};display:grid;grid-template-rows:auto 1fr;gap:8px`;
  }

  update(snapshot: StashSnapshot): void {
    const signature = JSON.stringify(snapshot);
    if (signature === this.signature) return;
    this.signature = signature;
    this.element.replaceChildren(this.createHeader(snapshot), this.createColumns(snapshot));
  }

  private createColumns(snapshot: StashSnapshot): HTMLDivElement {
    const columns = document.createElement("div");
    columns.style.cssText = "min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px";
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
