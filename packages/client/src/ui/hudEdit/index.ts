import type Phaser from "phaser";
import { WIDGET_DEPTH } from "../widgets/container.js";
import type { WidgetRegistry } from "../widgets/registry.js";
import type { Viewport } from "../widgets/state.js";
import { CatalogPanel } from "./catalogPanel.js";
import { DragHandle } from "./dragHandle.js";
import { GearChip } from "./gearChip.js";
import { ResizeHandle } from "./resizeHandle.js";
import { recomputeAnchor, toStoredOffset } from "./snap.js";
import { createHudEditState, type HudEditState } from "./state.js";
import { touchControlSize, touchResizeOverride } from "./touchControlResize.js";

/** Above every ordinary HUD widget so edit-mode chrome always draws on top. */
const EDIT_DEPTH = WIDGET_DEPTH + 1000;

interface HudEditModeOptions {
  scene: Phaser.Scene;
  registry: WidgetRegistry;
  viewport: Viewport;
  onLayoutChanged: () => void;
}

export class HudEditMode {
  private readonly state: HudEditState = createHudEditState();
  private readonly scene: Phaser.Scene;
  private readonly registry: WidgetRegistry;
  private readonly onLayoutChanged: () => void;
  private readonly gearChip: GearChip;
  private readonly catalogPanel: CatalogPanel;
  private readonly handles = new Map<string, DragHandle>();
  private readonly resizeHandles = new Map<string, ResizeHandle>();
  private resizing: { id: string; center: { x: number; y: number }; size: number } | null = null;
  private viewport: Viewport;

  constructor({ scene, registry, viewport, onLayoutChanged }: HudEditModeOptions) {
    this.scene = scene;
    this.registry = registry;
    this.viewport = viewport;
    this.onLayoutChanged = onLayoutChanged;
    this.gearChip = new GearChip({ scene, viewport, depth: EDIT_DEPTH, onToggle: () => this.toggle() });
    this.catalogPanel = new CatalogPanel({
      scene,
      depth: EDIT_DEPTH,
      listDefinitions: () => this.registry.listDefinitions(),
      overrideFor: (id) => this.registry.getOverride(id),
      actions: { onToggleVisible: (id) => this.toggleVisible(id), onSave: () => this.save(), onReset: () => this.reset() },
    });
    this.catalogPanel.container.setVisible(false);
    this.catalogPanel.reposition(viewport);
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer));
    scene.input.keyboard?.on("keydown-F10", (event: KeyboardEvent) => {
      event.preventDefault();
      this.toggle();
    });
  }

  get active(): boolean { return this.state.active; }

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
    this.resizing = null;
    this.gearChip.setActive(false);
    this.catalogPanel.container.setVisible(false);
    this.clearHandles();
  }

  private clearHandles(): void {
    for (const handle of this.handles.values()) handle.destroy();
    this.handles.clear();
    for (const handle of this.resizeHandles.values()) handle.destroy();
    this.resizeHandles.clear();
  }

  private rebuildHandles(): void {
    this.clearHandles();
    const resolved = this.registry.resolve(this.viewport);
    for (const definition of this.registry.listDefinitions()) {
      const layout = resolved.get(definition.id);
      if (!layout?.visible) continue;
      const id = definition.id;
      const handle = new DragHandle({ scene: this.scene, id, point: { x: layout.x, y: layout.y }, depth: EDIT_DEPTH, onGrab: (pointer) => this.beginDrag(id, pointer, layout) });
      this.handles.set(id, handle);
      const size = touchControlSize(id);
      if (size) {
        const point = { x: layout.x + (size * layout.scale) / 2, y: layout.y + (size * layout.scale) / 2 };
        const resize = new ResizeHandle({ scene: this.scene, point, depth: EDIT_DEPTH, onGrab: () => this.beginResize(id, layout, size) });
        this.resizeHandles.set(id, resize);
      }
    }
  }

  private beginDrag(id: string, pointer: Phaser.Input.Pointer, layout: { x: number; y: number }): void {
    this.state.drag = { widgetId: id, grabOffset: { x: pointer.x - layout.x, y: pointer.y - layout.y } };
  }

  private beginResize(id: string, layout: { x: number; y: number }, size: number): void {
    this.resizing = { id, center: { x: layout.x, y: layout.y }, size };
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.state.drag;
    if (!this.state.active || !drag || this.resizing) return;
    this.handles.get(drag.widgetId)?.moveTo({ x: pointer.x - drag.grabOffset.x, y: pointer.y - drag.grabOffset.y });
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.resizing) {
      const override = touchResizeOverride(pointer, this.resizing, this.registry.getHudScale());
      this.resizing = null;
      this.registry.setOverride(override.id, { scale: override.scale });
      this.onLayoutChanged();
      return this.rebuildHandles();
    }
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
