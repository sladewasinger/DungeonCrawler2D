/** Owns persisted HUD window layout, play-mode chrome, and edit-mode manipulation. */
import { isTouchDevice } from "../input/touchDetect.js";
import { anchoredPosition, closestAnchor } from "./HudWindowGeometry.js";
import { loadWindowLayouts, saveWindowLayouts, type HudWindowLayout } from "./hudWindowStorage.js";

export type HudAnchor = "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right" | "free";

export interface HudWindowSpec {
  id: string;
  title: string;
  width: number;
  height: number;
  anchor: Exclude<HudAnchor, "free">;
  content: HTMLElement;
  mobile?: Pick<HudWindowSpec, "width" | "height" | "anchor">;
  interactive?: boolean;
}

interface HudWindowRecord {
  element: HTMLDivElement;
  header: HTMLDivElement;
  content: HTMLDivElement;
  pin: HTMLSelectElement;
  layout: HudWindowLayout;
  interactive: boolean;
}

const MOBILE_SCALE = 0.66;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const option = (value: HudAnchor, label: string) => {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
};

const buildWindow = (spec: HudWindowSpec) => {
  const element = document.createElement("div");
  element.dataset.hudWindow = spec.id;
  element.style.cssText = "position:absolute;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;pointer-events:auto;color:#f2f0eb;font:12px monospace;box-sizing:border-box";
  const header = document.createElement("div");
  header.style.cssText = "height:27px;flex:0 0 27px;display:flex;align-items:center;gap:8px;padding:0 6px;background:#292b40;border-bottom:1px solid #474b65;cursor:move;user-select:none;touch-action:none";
  const title = document.createElement("span");
  title.textContent = spec.title;
  title.style.cssText = "font-weight:700;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1";
  const pin = document.createElement("select");
  pin.setAttribute("aria-label", `${spec.title} pin position`);
  pin.style.cssText = "max-width:94px;background:#171827;color:#e6e4ec;border:1px solid #555a75;font:10px monospace";
  pin.append(option("free", "free"));
  for (const anchor of ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"] as const) pin.append(option(anchor, anchor.replace("-", " ")));
  const content = document.createElement("div");
  content.style.cssText = "min-height:0;flex:1;overflow:auto;padding:8px;box-sizing:border-box";
  content.append(spec.content);
  header.append(title, pin);
  element.append(header, content);
  return { element, header, content, pin };
};

export class HudWindowManager {
  private readonly layer = document.createElement("div");
  private readonly records = new Map<string, HudWindowRecord>();
  private readonly stored = loadWindowLayouts();
  private readonly mobile = isTouchDevice();
  private zCounter = 10;
  private editing = false;

  constructor(private readonly root: HTMLElement) {
    this.layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    root.append(this.layer);
    window.addEventListener("resize", () => this.layoutAll());
  }

  add(spec: HudWindowSpec): HTMLElement {
    const mobileSpec = this.mobile && spec.mobile ? { ...spec, ...spec.mobile } : spec;
    const built = buildWindow(mobileSpec);
    const stored = this.stored[spec.id];
    const layout = this.useMobileDefault(spec, stored)
      ? { anchor: mobileSpec.anchor, x: 0, y: 0, width: mobileSpec.width, height: mobileSpec.height, z: ++this.zCounter }
      : stored ?? { anchor: mobileSpec.anchor, x: 0, y: 0, width: mobileSpec.width, height: mobileSpec.height, z: ++this.zCounter };
    const record = { ...built, layout, interactive: Boolean(spec.interactive) };
    this.layer.append(record.element);
    this.records.set(spec.id, record);
    this.zCounter = Math.max(this.zCounter, layout.z);
    record.pin.value = layout.anchor;
    this.apply(record);
    this.bindWindow(record);
    return record.content;
  }

  setEditing(editing: boolean): void {
    this.editing = editing;
    for (const record of this.records.values()) this.applyChrome(record);
  }

  setVisible(id: string, visible: boolean): void {
    const record = this.records.get(id);
    if (record) record.element.style.display = visible ? "flex" : "none";
  }

  private bindWindow(record: HudWindowRecord): void {
    this.bindDrag(record);
    record.element.addEventListener("pointerdown", () => this.raise(record));
    record.pin.addEventListener("change", () => this.pinWindow(record));
    new ResizeObserver(() => this.resizeWindow(record)).observe(record.element);
  }

  private pinWindow(record: HudWindowRecord): void {
    record.layout.anchor = record.pin.value as HudAnchor;
    this.apply(record);
    this.persist();
  }

  private resizeWindow(record: HudWindowRecord): void {
    if (!this.editing) return;
    const rect = record.element.getBoundingClientRect();
    record.layout.width = Math.round(rect.width / this.scale);
    record.layout.height = Math.round(rect.height / this.scale);
    this.apply(record);
    this.persist();
  }

  private bindDrag(record: HudWindowRecord): void {
    record.header.addEventListener("pointerdown", (event) => {
      if (!this.editing || event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      event.stopPropagation();
      this.beginDrag(record, event);
    });
  }

  private beginDrag(record: HudWindowRecord, event: PointerEvent): void {
      const rootRect = this.root.getBoundingClientRect();
      const rect = record.element.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      record.layout.anchor = "free";
      record.pin.value = "free";
      this.raise(record);
      record.header.setPointerCapture(event.pointerId);
      const move = (moveEvent: PointerEvent) => this.moveWindow(record, rootRect, offsetX, offsetY, moveEvent);
      const finish = () => this.finishDrag(record, rootRect, move);
      record.header.addEventListener("pointermove", move);
      record.header.addEventListener("pointerup", finish, { once: true });
      record.header.addEventListener("pointercancel", finish, { once: true });
  }

  private useMobileDefault(spec: HudWindowSpec, stored: HudWindowLayout | undefined): boolean {
    if (!this.mobile || !spec.mobile || !stored) return false;
    return stored.anchor === spec.anchor && stored.x === 0 && stored.y === 0 && stored.width === spec.width && stored.height === spec.height;
  }

  private moveWindow(record: HudWindowRecord, rootRect: DOMRect, offsetX: number, offsetY: number, event: PointerEvent): void {
    const size = this.size(record);
    record.layout.x = clamp(Math.round(event.clientX - rootRect.left - offsetX), 0, Math.max(0, rootRect.width - size.width));
    record.layout.y = clamp(Math.round(event.clientY - rootRect.top - offsetY), 0, Math.max(0, rootRect.height - size.height));
    this.apply(record);
  }

  private finishDrag(record: HudWindowRecord, rootRect: DOMRect, move: (event: PointerEvent) => void): void {
    record.header.removeEventListener("pointermove", move);
    if (!this.mobile) record.layout.anchor = this.snap(record, rootRect);
    record.pin.value = record.layout.anchor;
    this.apply(record);
    this.persist();
  }

  private snap(record: HudWindowRecord, rootRect: DOMRect): HudAnchor {
    const size = this.size(record);
    return closestAnchor(record.layout.x, record.layout.y, size.width, size.height, rootRect.width, rootRect.height);
  }

  private get scale(): number {
    return this.mobile ? MOBILE_SCALE : 1;
  }

  private size(record: HudWindowRecord) {
    return { width: Math.round(record.layout.width * this.scale), height: Math.round(record.layout.height * this.scale) };
  }

  private raise(record: HudWindowRecord): void {
    record.layout.z = ++this.zCounter;
    record.element.style.zIndex = String(record.layout.z);
  }

  private apply(record: HudWindowRecord): void {
    const size = this.size(record);
    const anchored = anchoredPosition(record.layout.anchor, size.width, size.height, this.root.clientWidth, this.root.clientHeight);
    const x = record.layout.anchor === "free" ? record.layout.x : anchored.x;
    const y = record.layout.anchor === "free" ? record.layout.y : anchored.y;
    record.element.style.left = `${x}px`;
    record.element.style.top = `${y}px`;
    record.element.style.width = `${size.width}px`;
    record.element.style.height = `${size.height}px`;
    record.element.style.zIndex = String(record.layout.z);
    this.applyChrome(record);
  }

  private applyChrome(record: HudWindowRecord): void {
    record.header.style.display = this.editing ? "flex" : "none";
    record.content.style.padding = this.editing ? "8px" : "0";
    record.content.style.overflow = this.editing ? "auto" : "visible";
    record.element.style.resize = this.editing ? "both" : "none";
    record.element.style.pointerEvents = this.editing || record.interactive ? "auto" : "none";
    record.element.style.background = this.editing ? "rgba(17,18,29,.91)" : "transparent";
    record.element.style.border = this.editing ? "1px solid #5b5f77" : "none";
    record.element.style.boxShadow = this.editing ? "0 10px 24px rgba(0,0,0,.4)" : "none";
  }

  private layoutAll(): void {
    for (const record of this.records.values()) this.apply(record);
  }

  private persist(): void {
    const windows = Object.fromEntries([...this.records].map(([id, record]) => [id, record.layout]));
    saveWindowLayouts(windows);
  }
}
