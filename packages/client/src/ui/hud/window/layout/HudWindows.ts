/* eslint-disable max-lines -- manager lifecycle is intentionally a single ownership boundary. */
/** Owns persistent, geometry-stable HTML HUD windows and edit-mode manipulation. */
import {
  inputModality,
  type InputModality,
} from "../../../../input/controls/inputModality.js";
import {
  bindHudWindowEditing,
  type EditableHudWindow,
  type HudWindowEditingBinding,
} from "../gestures/HudWindowEditing.js";
import {
  resolveWindowSize,
  type HudWindowSpec,
} from "./HudWindowLayout.js";
import { type HudWindowRecord } from "./HudWindowRecord.js";
import {
  loadWindowLayouts,
  saveWindowLayouts,
} from "./hudWindowStorage.js";
import {
  applyHudWindowChrome,
  buildManagedHudWindow,
  resolveRenderedHudWindowGeometry,
} from "./HudWindowManagerSupport.js";
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
  private mobile = inputModality.current === "touch";
  private readonly stopModality: () => void;
  private readonly listeners = new Set<() => void>();
  private zCounter = 10;
  private editing = false;

  constructor(private readonly root: HTMLElement) {
    this.stored = loadWindowLayouts({
      width: root.clientWidth || window.innerWidth,
      height: root.clientHeight || window.innerHeight,
      scale: this.scale,
    });
    this.layer.className = "hud-window-layer";
    root.append(this.layer);
    window.addEventListener("resize", this.layoutAll);
    this.stopModality = inputModality.subscribe((mode) => this.applyModality(mode));
  }

  add(spec: HudWindowSpec): HTMLElement {
    const record = buildManagedHudWindow({
      spec, mobile: this.mobile, stored: this.stored[spec.id], z: ++this.zCounter,
      viewport: this.viewport(), scale: this.scale,
    });
    this.layer.append(record.element);
    this.records.set(spec.id, record);
    this.zCounter = Math.max(this.zCounter, record.layout.z);
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
    this.stopModality();
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
    const viewport = this.viewport();
    const requestedSize = resolveWindowSize(record.layout, viewport, record);
    const visible = record.layout.visible !== false;
    Object.assign(record.element.style, {
      display: visible ? "block" : "none",
      width: `${requestedSize.width}px`,
      height: `${requestedSize.height}px`,
      zIndex: String(record.layout.z),
    });
    const { position } = resolveRenderedHudWindowGeometry({
      element: record.element,
      requestedSize,
      layout: record.layout,
      viewport,
    });
    record.element.style.left = `${position.x}px`;
    record.element.style.top = `${position.y}px`;
    this.applyChrome(record);
  }

  private applyChrome(record: HudWindowRecord): void {
    applyHudWindowChrome(record, this.editing);
  }

  private readonly layoutAll = (): void => {
    for (const record of this.records.values()) this.apply(record);
  };

  private viewport(): { width: number; height: number } {
    return {
      width: this.root.clientWidth || window.innerWidth,
      height: this.root.clientHeight || window.innerHeight,
    };
  }

  private applyModality(mode: InputModality): void {
    const mobile = mode === "touch";
    if (mobile === this.mobile) return;
    this.mobile = mobile;
    this.layoutAll();
  }

  private persist(): void {
    saveWindowLayouts(Object.fromEntries(
      [...this.records].map(([id, record]) => [id, record.layout]),
    ));
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
