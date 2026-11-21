import { describe, expect, it } from "vitest";
import { adminCatalogEntries } from "../adminCatalogDefinitions.js";
import { createAdminSpawnCatalog } from "../adminSpawnCatalog.js";
import { ADMIN_SPAWN_TYPES } from "../adminSpawnTypeTabs.js";

describe("admin spawn catalog DOM contract", () => {
  it("exposes readable semantic tabs and independently dispatches cards", () => {
    const previousDocument = globalThis.document;
    globalThis.document = new FakeDocument() as unknown as Document;
    try {
      assertCatalogInteractions();
    } finally {
      globalThis.document = previousDocument;
    }
  });
});

function assertCatalogInteractions(): void {
  const catalog = createAdminSpawnCatalog();
  const selectedKinds: string[] = [];
  const selectedCards: string[] = [];
  const labels = ["Enemy", "Item", "Weapon", "Pet"];
  for (const [index, kind] of ADMIN_SPAWN_TYPES.entries()) {
    const entry = adminCatalogEntries(kind)[0]!;
    renderCatalogKind({ catalog, kind, id: entry.id, selectedKinds, selectedCards });
    const root = catalog.root as unknown as FakeElement;
    const tablist = descendants(root, (node) => node.getAttribute("role") === "tablist")[0];
    const tabs = descendants(root, (node) => node.getAttribute("role") === "tab");
    const panel = descendants(root, (node) => node.getAttribute("role") === "tabpanel")[0];
    const cards = descendants(root, (node) => node.dataset.adminCatalogCard !== undefined);
    assertTabContract({ tablist, tabs, panel, kind, labels });
    const selectedCard = assertSelectedCard(cards, entry.id, entry.name);
    tabs.forEach((tab) => tab.click());
    selectedCard?.click();
    expect(selectedCards[index]).toBe(entry.id);
  }
  expect(new Set(selectedKinds)).toEqual(new Set(ADMIN_SPAWN_TYPES));
}

interface CatalogRenderInput {
  readonly catalog: ReturnType<typeof createAdminSpawnCatalog>;
  readonly kind: (typeof ADMIN_SPAWN_TYPES)[number];
  readonly id: string;
  readonly selectedKinds: string[];
  readonly selectedCards: string[];
}

function renderCatalogKind(input: CatalogRenderInput): void {
  input.catalog.render({
    kind: input.kind,
    selectedId: input.id,
    availableIds: [input.id],
    disabled: false,
    onSelectKind: (selected) => { input.selectedKinds.push(selected); },
    onSelect: (selected) => { input.selectedCards.push(selected); },
  });
}

interface TabContractInput {
  readonly tablist: FakeElement | undefined;
  readonly tabs: readonly FakeElement[];
  readonly panel: FakeElement | undefined;
  readonly kind: (typeof ADMIN_SPAWN_TYPES)[number];
  readonly labels: readonly string[];
}

function assertTabContract(input: TabContractInput): void {
  expect(input.tablist?.getAttribute("aria-label")).toBe("Entity type");
  expect(input.tabs.map((tab) => tab.textContent)).toEqual(input.labels);
  expect(input.tabs.every((tab) => tab.getAttribute("aria-selected") === String(tab.dataset.adminCatalogKind === input.kind))).toBe(true);
  expect(input.panel?.getAttribute("role")).toBe("tabpanel");
  const activeTab = input.tabs.find((tab) => tab.dataset.adminCatalogKind === input.kind);
  expect(activeTab).toBeDefined();
  expect(activeTab?.getAttribute("aria-controls")).toBe(input.panel?.id);
  expect(input.panel?.getAttribute("aria-labelledby")).toBe(activeTab?.id);
}

function assertSelectedCard(
  cards: readonly FakeElement[],
  id: string,
  name: string,
): FakeElement {
  expect(cards.length).toBeGreaterThan(0);
  const selectedCard = cards.find((card) => card.dataset.definitionId === id);
  expect(selectedCard).toBeDefined();
  expect(visibleText(selectedCard!)).toContain(name);
  expect(selectedCard?.getAttribute("aria-pressed")).toBe("true");
  return selectedCard!;
}

function descendants(root: FakeElement, predicate: (node: FakeElement) => boolean): FakeElement[] {
  return root.children.flatMap((child) => [
    ...(predicate(child) ? [child] : []),
    ...descendants(child, predicate),
  ]);
}

function visibleText(node: FakeElement): string {
  return [node.textContent, ...node.children.map(visibleText)].join(" ");
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = { cssText: "" };
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, (() => void)[]>();
  textContent = "";
  title = "";
  id = "";
  src = "";
  alt = "";
  hidden = false;
  disabled = false;

  append(...nodes: FakeElement[]): void { this.children.push(...nodes); }
  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...nodes);
  }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  click(): void { this.listeners.get("click")?.forEach((listener) => listener()); }
}
