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

const createColumn = (
  title: string,
  rows: readonly StashRowView[],
  action: string | null,
  onAction?: (index: number, itemId: string) => void,
): HTMLDivElement => {
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

  constructor(
    private readonly put: (index: number) => void,
    private readonly take: (index: number, itemId: string) => void,
    private readonly takeAll: () => void,
    private readonly close: () => void,
  ) {
    this.element.style.cssText =
      `${HUD_PANEL};display:grid;grid-template-rows:auto 1fr;gap:8px`;
  }

  update(snapshot: StashSnapshot): void {
    const signature = JSON.stringify(snapshot);
    if (signature === this.signature) return;
    this.signature = signature;
    const columns = document.createElement("div");
    columns.style.cssText =
      "min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px";
    columns.append(
      createColumn("Inventory", snapshot.inventory, snapshot.kind === "loot" ? null : "put", this.put),
      createColumn(snapshot.kind === "loot" ? "Loot" : "Stash", snapshot.entries, "take", this.take),
    );
    const header = createHudPanelHeader(snapshot.kind === "loot" ? "Death Loot" : "Stash", this.close);
    if (snapshot.kind === "loot" && snapshot.entries.length > 0) {
      header.append(createHudButton("take all", this.takeAll));
    }
    this.element.replaceChildren(header, columns);
  }
}
