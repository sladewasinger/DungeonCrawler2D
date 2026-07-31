import type { AdminDebugPoint } from "../../../render/debug/adminDebugGeometry.js";
import {
  createThreeTextSprite,
  updateThreeTextSprite,
  type ThreeTextSprite,
} from "../entities/ThreeTextSprite.js";
import * as THREE from "three";

const LABEL_COLOR = "#eaf4ff";

type ThreeGroup = InstanceType<typeof THREE.Group>;
type ThreeSprite = InstanceType<typeof THREE.Sprite>;

interface LabelEntry {
  readonly sprite: ThreeSprite;
  text: string;
}

/** Reassigns a bounded label pool while retaining textures for repeated states. */
export class ThreeDebugLabelPool {
  private readonly entries: LabelEntry[] = [];
  private readonly byId = new Map<string, LabelEntry>();
  private readonly inactive: LabelEntry[] = [];
  private readonly usedIds = new Set<string>();

  constructor(
    private readonly group: ThreeGroup,
    private readonly capacity: number,
  ) {}

  beginFrame(): void {
    this.usedIds.clear();
  }

  label(id: string, text: string, point: AdminDebugPoint): void {
    const entry = this.byId.get(id) ?? this.assignEntry(id, text);
    if (!entry) return;
    this.usedIds.add(id);
    updateEntryText(entry, text);
    entry.sprite.position.set(point.x, point.z + 1.45, point.y);
    entry.sprite.visible = true;
  }

  endFrame(): void {
    for (const [id, entry] of this.byId) {
      if (this.usedIds.has(id)) continue;
      this.byId.delete(id);
      entry.sprite.visible = false;
      this.inactive.push(entry);
    }
  }

  dispose(): void {
    for (const entry of this.entries) disposeEntry(entry);
    this.entries.length = 0;
    this.byId.clear();
    this.inactive.length = 0;
  }

  private assignEntry(id: string, text: string): LabelEntry | undefined {
    const entry = this.takeInactive(text) ?? this.createEntry(text);
    if (entry) this.byId.set(id, entry);
    return entry;
  }

  private takeInactive(text: string): LabelEntry | undefined {
    const matching = this.inactive.findIndex((entry) => entry.text === text);
    const index = matching >= 0 ? matching : this.inactive.length - 1;
    if (index < 0) return undefined;
    return this.inactive.splice(index, 1)[0];
  }

  private createEntry(text: string): LabelEntry | undefined {
    if (this.entries.length >= this.capacity) return undefined;
    const sprite = createThreeTextSprite(text, LABEL_COLOR) as unknown as ThreeSprite;
    const entry = { sprite, text };
    sprite.visible = false;
    this.entries.push(entry);
    this.group.add(sprite);
    return entry;
  }
}

function updateEntryText(entry: LabelEntry, text: string): void {
  if (entry.text === text) return;
  updateThreeTextSprite(entry.sprite as unknown as ThreeTextSprite, text, LABEL_COLOR);
  entry.text = text;
}

function disposeEntry(entry: LabelEntry): void {
  entry.sprite.material.map?.dispose();
  entry.sprite.material.dispose();
  entry.sprite.removeFromParent();
}
