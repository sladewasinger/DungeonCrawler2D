/** Owns persistent, geometry-stable HTML HUD windows and edit-mode manipulation. */
import { isTouchDevice } from "../input/touchDetect.js";
import {
  bindHudWindowEditing,
  type EditableHudWindow,
  type HudWindowEditingBinding,
} from "./HudWindowEditing.js";
import {
  defaultWindowLayout,
  resolveWindowPosition,
  restoreStoredLayout,
  scaledWindowSize,
  shouldUseMobileDefault,
  type HudWindowSpec,
} from "./HudWindowLayout.js";
import {
  buildHudWindow,
  type HudWindowRecord,
} from "./HudWindowRecord.js";
import {
  loadWindowLayouts,
  saveWindowLayouts,
} from "./hudWindowStorage.js";
export type { HudAnchor, HudWindowSpec } from "./HudWindowLayout.js";

export interface HudWindowView {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
}

const MOBILE_SCALE = 0.66;

export class HudWindowManager {
  private readonly layer = document.createElement("div");
  private readonly records = new Map<string, HudWindowRecord>();
  private readonly editingBindings = new Map<string, HudWindowEditingBinding>();
  private readonly stored: ReturnType<typeof loadWindowLayouts>;
  private readonly mobile = isTouchDevice();
  private readonly listeners = new Set<() => void>();
  private zCounter = 10;
  private editing = false;

  constructor(private readonly root: HTMLElement) {
    this.stored = loadWindowLayouts({
      width: root.clientWidth || window.innerWidth,
      height: root.clientHeight || window.innerHeight,
    });
    this.layer.style.cssText =
      "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    root.append(this.layer);
    window.addEventListener("resize", this.layoutAll);
  }

  add(spec: HudWindowSpec): HTMLElement {
    const effective = this.mobile && spec.mobile ? { ...spec, ...spec.mobile } : spec;
    const stored = this.stored[spec.id];
    const defaultVisible = spec.defaultVisible ?? true;
    const defaults = defaultWindowLayout(
      effective,
      defaultVisible,
      ++this.zCounter,
    );
    const layout = shouldUseMobileDefault(this.mobile, spec, stored)
      ? defaults
      : stored
        ? restoreStoredLayout(stored, defaults)
        : defaults;
    const built = buildHudWindow(effective);
    const record = {
      ...built,
      id: spec.id,
      title: spec.title,
      layout,
      interactive: Boolean(spec.interactive),
    };
    this.layer.append(record.element);
    this.records.set(spec.id, record);
    this.zCounter = Math.max(this.zCounter, layout.z);
    this.bindWindow(record);
    this.apply(record);
    return record.content;
  }

  setEditing(editing: boolean): void {
    this.editing = editing;
    for (const record of this.records.values()) {
      this.editingBindings.get(record.id)?.setEditing(editing);
      this.applyChrome(record);
    }
  }

  setVisible(id: string, visible: boolean): void {
    const record = this.records.get(id);
    if (!record || (record.layout.visible !== false) === visible) return;
    record.layout.visible = visible;
    this.apply(record);
    this.persist();
    this.notify();
  }

  isVisible(id: string): boolean {
    return this.records.get(id)?.layout.visible !== false;
  }

  windows(): HudWindowView[] {
    return [...this.records.values()].map(({ id, title, layout }) => ({
      id,
      title,
      visible: layout.visible !== false,
    }));
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    window.removeEventListener("resize", this.layoutAll);
    this.listeners.clear();
    this.editingBindings.clear();
    this.layer.remove();
  }

  private bindWindow(record: HudWindowRecord): void {
    record.element.addEventListener("pointerdown", () => this.raise(record));
    const binding = bindHudWindowEditing(record, {
      root: this.root,
      mobile: this.mobile,
      editing: () => this.editing,
      scale: () => this.scale,
      apply: () => this.apply(record),
      raise: () => this.raise(record),
      persist: () => this.persist(),
    });
    binding.setEditing(this.editing);
    this.editingBindings.set(record.id, binding);
  }

  private get scale(): number {
    return this.mobile ? MOBILE_SCALE : 1;
  }

  private raise(record: EditableHudWindow): void {
    record.layout.z = ++this.zCounter;
    record.element.style.zIndex = String(record.layout.z);
  }

  private apply(record: HudWindowRecord): void {
    const size = scaledWindowSize(record.layout, this.scale);
    const position = resolveWindowPosition(record.layout, size, {
      width: this.root.clientWidth,
      height: this.root.clientHeight,
    });
    const visible = record.layout.visible !== false;
    Object.assign(record.element.style, {
      display: visible ? "block" : "none",
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      zIndex: String(record.layout.z),
    });
    this.applyChrome(record);
  }

  private applyChrome(record: HudWindowRecord): void {
    record.element.style.resize = "none";
    record.element.style.pointerEvents = "auto";
    record.element.style.outline = this.editing ? "1px solid rgba(112,118,148,.9)" : "none";
    record.element.style.background = this.editing ? "rgba(17,18,29,.22)" : "transparent";
    record.element.style.boxShadow = this.editing ? "0 10px 24px rgba(0,0,0,.28)" : "none";
    record.element.style.touchAction = this.editing
      ? "none"
      : record.interactive
        ? "auto"
        : "manipulation";
  }

  private readonly layoutAll = (): void => {
    for (const record of this.records.values()) this.apply(record);
  };

  private persist(): void {
    saveWindowLayouts(Object.fromEntries(
      [...this.records].map(([id, record]) => [id, record.layout]),
    ));
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
