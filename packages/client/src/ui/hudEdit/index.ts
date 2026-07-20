/**
 * Edit-HUD mode facade (docs/HUD_OS.md Phase 2): owns the HudEditState instance and
 * every edit-mode Phaser object (gear chip, per-widget drag handles, catalog side
 * panel), and orchestrates entering/exiting, dragging, and save/reset. Constructed
 * once by HudWidgets (ui/widgets/hud/index.ts) alongside every other widget; entirely
 * self-contained — binds its own [F10] key rather than reaching into input/keys.ts,
 * and every interactive element is a real Phaser game object with its own pointer
 * listener (the inventory window's pattern, HUD_OS.md §7 Phase 1), not routed through
 * HudWidgets.hitTest()'s shared dispatch.
 */
import type Phaser from "phaser";
import { WIDGET_DEPTH } from "../widgets/container.js";
import type { WidgetRegistry } from "../widgets/registry.js";
import type { Viewport } from "../widgets/state.js";
import { CatalogPanel } from "./catalogPanel.js";
import { DragHandle } from "./dragHandle.js";
import { GearChip } from "./gearChip.js";
import { recomputeAnchor, toStoredOffset } from "./snap.js";
import { createHudEditState, type HudEditState } from "./state.js";

/** Above every ordinary HUD widget so edit-mode chrome always draws on top. */
const EDIT_DEPTH = WIDGET_DEPTH + 1000;

export class HudEditMode {
  private readonly state: HudEditState = createHudEditState();
  private readonly scene: Phaser.Scene;
  private readonly registry: WidgetRegistry;
  private readonly onLayoutChanged: () => void;
  private readonly gearChip: GearChip;
  private readonly catalogPanel: CatalogPanel;
  private readonly handles = new Map<string, DragHandle>();
  private viewport: Viewport;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport, onLayoutChanged: () => void) {
    this.scene = scene;
    this.registry = registry;
    this.viewport = viewport;
    this.onLayoutChanged = onLayoutChanged;
    this.gearChip = new GearChip(scene, viewport, EDIT_DEPTH, () => this.toggle());
    this.catalogPanel = new CatalogPanel(
      scene,
      EDIT_DEPTH,
      () => this.registry.listDefinitions(),
      (id) => this.registry.getOverride(id),
      { onToggleVisible: (id) => this.toggleVisible(id), onSave: () => this.save(), onReset: () => this.reset() },
    );
    this.catalogPanel.container.setVisible(false);
    this.catalogPanel.reposition(viewport);
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    scene.input.on("pointerup", () => this.handlePointerUp());
    scene.input.keyboard?.on("keydown-F10", (event: KeyboardEvent) => {
      event.preventDefault();
      this.toggle();
    });
  }

  get active(): boolean {
    return this.state.active;
  }

  toggle(): void {
    if (this.state.active) this.exit();
    else this.enter();
  }

  private enter(): void {
    this.state.active = true;
    this.gearChip.setActive(true);
    this.catalogPanel.container.setVisible(true);
    this.catalogPanel.refresh();
    this.rebuildHandles();
  }

  private exit(): void {
    this.state.active = false;
    this.state.drag = null;
    this.gearChip.setActive(false);
    this.catalogPanel.container.setVisible(false);
    this.clearHandles();
  }

  private clearHandles(): void {
    for (const handle of this.handles.values()) handle.destroy();
    this.handles.clear();
  }

  private rebuildHandles(): void {
    this.clearHandles();
    const resolved = this.registry.resolve(this.viewport);
    for (const definition of this.registry.listDefinitions()) {
      const layout = resolved.get(definition.id);
      if (!layout?.visible) continue;
      const id = definition.id;
      const handle = new DragHandle(this.scene, id, { x: layout.x, y: layout.y }, EDIT_DEPTH, (pointer) => this.beginDrag(id, pointer, layout));
      this.handles.set(id, handle);
    }
  }

  private beginDrag(id: string, pointer: Phaser.Input.Pointer, layout: { x: number; y: number }): void {
    this.state.drag = { widgetId: id, grabOffset: { x: pointer.x - layout.x, y: pointer.y - layout.y } };
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.state.drag;
    if (!this.state.active || !drag) return;
    this.handles.get(drag.widgetId)?.moveTo({ x: pointer.x - drag.grabOffset.x, y: pointer.y - drag.grabOffset.y });
  }

  private handlePointerUp(): void {
    const drag = this.state.drag;
    if (!this.state.active || !drag) return;
    this.state.drag = null;
    const handle = this.handles.get(drag.widgetId);
    if (!handle) return;
    const { anchor, offset } = recomputeAnchor(handle.currentPoint(), this.viewport);
    const storedOffset = toStoredOffset(offset, this.registry.getHudScale());
    this.registry.setOverride(drag.widgetId, { anchor, offset: storedOffset });
    this.onLayoutChanged();
    this.rebuildHandles();
  }

  private toggleVisible(id: string): void {
    const definition = this.registry.listDefinitions().find((candidate) => candidate.id === id);
    if (!definition) return;
    const current = this.registry.getOverride(id)?.visible ?? definition.defaultVisible;
    this.registry.setOverride(id, { visible: !current });
    this.onLayoutChanged();
    this.rebuildHandles();
    this.catalogPanel.refresh();
  }

  private save(): void {
    this.registry.persist();
    // Layout edits already persist as you drag, so a bare "save" felt like a dead
    // button (user 2026-07-20: "make it save and close the panel") — SAVE now
    // commits AND exits edit mode in one tap.
    this.exit();
  }

  private reset(): void {
    this.registry.resetToDefault();
    this.onLayoutChanged();
    this.rebuildHandles();
    this.catalogPanel.refresh();
  }

  /** Re-anchors edit-mode chrome for a new viewport (call from HudWidgets.resize()). */
  resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.gearChip.reposition(viewport);
    this.catalogPanel.reposition(viewport);
    if (this.state.active) this.rebuildHandles();
  }
}
