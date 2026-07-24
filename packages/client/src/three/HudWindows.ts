/** Owns persistent, geometry-stable HTML HUD windows and edit-mode manipulation. */
import { isTouchDevice } from "../input/touchDetect.js";
import { anchoredPosition } from "./HudWindowGeometry.js";
import { bindHudWindowEditing, type EditableHudWindow } from "./HudWindowEditing.js";
import { loadWindowLayouts, saveWindowLayouts, type HudWindowLayout } from "./hudWindowStorage.js";

export type HudAnchor = "top-left" | "top-center" | "top-right" |
  "center-left" | "center" | "center-right" | "bottom-left" |
  "bottom-center" | "bottom-right" | "free";

export interface HudWindowSpec {
  id: string;
  title: string;
  width: number;
  height: number;
  anchor: Exclude<HudAnchor, "free">;
  content: HTMLElement;
  mobile?: Pick<HudWindowSpec, "width" | "height" | "anchor">;
  interactive?: boolean;
  defaultVisible?: boolean;
}

export interface HudWindowView {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
}

interface HudWindowRecord {
  id: string;
  title: string;
  element: HTMLDivElement;
  content: HTMLDivElement;
  layout: HudWindowLayout;
  interactive: boolean;
}

const MOBILE_SCALE = 0.66;
const buildWindow = (spec: HudWindowSpec) => {
  const element = document.createElement("div");
  element.dataset.hudWindow = spec.id;
  element.setAttribute("aria-label", spec.title);
  element.style.cssText =
    "position:absolute;min-width:0;min-height:0;overflow:hidden;" +
    "color:#f2f0eb;font:12px monospace;box-sizing:border-box";
  const content = document.createElement("div");
  content.style.cssText =
    "width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box";
  content.append(spec.content);
  element.append(content);
  return { element, content };
};

export class HudWindowManager {
  private readonly layer = document.createElement("div");
  private readonly records = new Map<string, HudWindowRecord>();
  private readonly stored = loadWindowLayouts();
  private readonly mobile = isTouchDevice();
  private readonly listeners = new Set<() => void>();
  private zCounter = 10;
  private editing = false;

  constructor(private readonly root: HTMLElement) {
    this.layer.style.cssText =
      "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    root.append(this.layer);
    window.addEventListener("resize", () => this.layoutAll());
  }

  add(spec: HudWindowSpec): HTMLElement {
    const effective = this.mobile && spec.mobile ? { ...spec, ...spec.mobile } : spec;
    const stored = this.stored[spec.id];
    const defaultVisible = spec.defaultVisible ?? true;
    const defaults = this.defaultLayout(effective, defaultVisible);
    const layout = this.useMobileDefault(spec, stored)
      ? defaults
      : stored
        ? { ...stored, visible: stored.visible ?? defaultVisible }
        : defaults;
    const built = buildWindow(effective);
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
    for (const record of this.records.values()) this.applyChrome(record);
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

  private defaultLayout(spec: HudWindowSpec, visible: boolean): HudWindowLayout {
    return {
      anchor: spec.anchor,
      x: 0,
      y: 0,
      width: spec.width,
      height: spec.height,
      z: ++this.zCounter,
      visible,
    };
  }

  private bindWindow(record: HudWindowRecord): void {
    record.element.addEventListener("pointerdown", () => this.raise(record));
    bindHudWindowEditing(record, {
      root: this.root,
      mobile: this.mobile,
      editing: () => this.editing,
      scale: () => this.scale,
      apply: () => this.apply(record),
      raise: () => this.raise(record),
      persist: () => this.persist(),
    });
  }

  private useMobileDefault(
    spec: HudWindowSpec,
    stored: HudWindowLayout | undefined,
  ): boolean {
    if (!this.mobile || !spec.mobile || !stored) return false;
    return stored.anchor === spec.anchor && stored.x === 0 && stored.y === 0 &&
      stored.width === spec.width && stored.height === spec.height;
  }

  private get scale(): number {
    return this.mobile ? MOBILE_SCALE : 1;
  }

  private size(record: HudWindowRecord) {
    return {
      width: Math.round(record.layout.width * this.scale),
      height: Math.round(record.layout.height * this.scale),
    };
  }

  private raise(record: EditableHudWindow): void {
    record.layout.z = ++this.zCounter;
    record.element.style.zIndex = String(record.layout.z);
  }

  private apply(record: HudWindowRecord): void {
    const size = this.size(record);
    const anchored = anchoredPosition(
      record.layout.anchor,
      size.width,
      size.height,
      this.root.clientWidth,
      this.root.clientHeight,
    );
    const position = record.layout.anchor === "free" ?
      { x: record.layout.x, y: record.layout.y } : anchored;
    Object.assign(record.element.style, {
      display: record.layout.visible !== false ? "block" : "none",
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      zIndex: String(record.layout.z),
    });
    this.applyChrome(record);
  }

  private applyChrome(record: HudWindowRecord): void {
    record.element.style.resize = this.editing ? "both" : "none";
    record.element.style.pointerEvents = this.editing || record.interactive ? "auto" : "none";
    record.element.style.outline = this.editing ? "1px solid rgba(112,118,148,.9)" : "none";
    record.element.style.background = this.editing ? "rgba(17,18,29,.22)" : "transparent";
    record.element.style.boxShadow = this.editing ? "0 10px 24px rgba(0,0,0,.28)" : "none";
    record.element.style.touchAction = this.editing ? "none" : "auto";
  }

  private layoutAll(): void {
    for (const record of this.records.values()) this.apply(record);
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
