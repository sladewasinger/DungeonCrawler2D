/** Admin ?debug=1 creature spawner popover for quick live combat testing in the Overworld. */
import type { EntityKind } from "@dc2d/engine";

interface SpawnPreset {
  readonly label: string;
  readonly kind: EntityKind;
  readonly count: number;
}

const SPAWN_PRESETS: readonly SpawnPreset[] = [
  { label: "Wolf", kind: "wolf", count: 1 },
  { label: "3-Wolf Pack", kind: "wolf", count: 3 },
  { label: "Grizzly Bear", kind: "bear", count: 1 },
  { label: "Wild Boar", kind: "boar", count: 1 },
  { label: "Forest Spider", kind: "spider", count: 1 },
  { label: "Slime", kind: "slime", count: 1 },
  { label: "Goblin", kind: "goblin", count: 1 },
  { label: "Orc", kind: "orc", count: 1 },
  { label: "Skeleton", kind: "skeleton", count: 1 },
  { label: "Stone Golem", kind: "golem", count: 1 },
];

export class DebugSpawnPopover {
  readonly el: HTMLDivElement;
  private open = false;

  constructor(onSpawn: (kind: EntityKind, count: number) => void) {
    this.el = document.createElement("div");
    this.el.className = "ow-drawer";
    const row = document.createElement("div");
    row.className = "ow-presets";
    for (const p of SPAWN_PRESETS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ow-pill";
      b.textContent = p.label;
      b.addEventListener("click", () => onSpawn(p.kind, p.count));
      row.append(b);
    }
    this.el.append(row);
  }

  toggle(): boolean {
    this.open = !this.open;
    this.el.dataset.open = String(this.open);
    return this.open;
  }
}
