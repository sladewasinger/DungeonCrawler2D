/** Custom Hero Creator modal: name input, live layered preview, body, skin, and hair pickers. */
import { EYE_PALETTES, HAIR_PALETTES, SKIN_PALETTES } from "@dc2d/content";
import {
  BODY_STYLES, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES,
  type ArmorEquipment, type CharacterAppearance,
} from "@dc2d/engine";
import { characterCacheKey, getCharacterCacheRevision, getCharacterPortraitUrl } from "../../render/character/characterSprites.js";
import { domNode } from "./slotRenderer.js";

const TAG_BTN = "button";
const TAG_DIV = "div";
const CLS_PILL = "ow-pill";

const LABELS: Readonly<Record<string, string>> = {
  male: "Male", female: "Female",
  short: "Short", long: "Long", spiky: "Spiky", ponytail: "Ponytail", bald: "Bald",
};

interface CharBtnEntry { readonly key: string; readonly btn: HTMLButtonElement }

export class CharacterPanel {
  readonly el: HTMLElement;
  private readonly previewEl: HTMLImageElement;
  private readonly nameInput: HTMLInputElement;
  private readonly buttons: Record<"body" | "skin" | "eyeColor" | "hairStyle" | "hairColor", CharBtnEntry[]> = {
    body: [], skin: [], eyeColor: [], hairStyle: [], hairColor: [],
  };
  private currentName = "Adventurer";
  private currentApp: CharacterAppearance | null = null;
  private lastFp = "";

  constructor(
    host: HTMLElement,
    private readonly onUpdate: (req: { readonly name: string; readonly appearance: CharacterAppearance }) => void,
    onClose: () => void,
  ) {
    this.el = domNode("section", "ow-modal ow-hero-modal");
    this.el.hidden = true;
    this.previewEl = domNode("img", "ow-hero-preview");
    this.previewEl.alt = "Hero Preview";
    this.nameInput = buildNameInput((name) => this.emitChange(name, this.currentApp));
    this.el.append(buildHeader(onClose), this.buildTopRow(), this.buildPickers());
    host.append(this.el);
  }

  private buildTopRow(): HTMLDivElement {
    const top = domNode(TAG_DIV, "ow-hero-top");
    const nameWrap = domNode(TAG_DIV, "ow-craft-info");
    const lbl = domNode(TAG_DIV, "ow-craft-sub");
    lbl.textContent = "Hero Name (auto-saved)";
    lbl.style.marginBottom = "4px";
    nameWrap.append(lbl, this.nameInput);
    top.append(this.previewEl, nameWrap);
    return top;
  }

  private buildPickers(): HTMLDivElement {
    const form = domNode(TAG_DIV, "ow-hero-form");
    form.append(
      this.makeOptionRow({ title: "Body", field: "body", keys: BODY_STYLES }),
      this.makeSwatchRow({ title: "Skin", field: "skin", keys: SKIN_TONES, palettes: SKIN_PALETTES }),
      this.makeSwatchRow({ title: "Eyes", field: "eyeColor", keys: EYE_COLORS, palettes: EYE_PALETTES }),
      this.makeOptionRow({ title: "Hair", field: "hairStyle", keys: HAIR_STYLES }),
      this.makeSwatchRow({ title: "Color", field: "hairColor", keys: HAIR_COLORS, palettes: HAIR_PALETTES }),
    );
    return form;
  }

  private makeOptionRow(opts: { readonly title: string; readonly field: "body" | "hairStyle"; readonly keys: readonly string[] }): HTMLDivElement {
    const row = domNode(TAG_DIV, "ow-hero-row");
    const lbl = domNode("span", "ow-hero-lbl");
    lbl.textContent = opts.title;
    row.append(lbl);
    for (const key of opts.keys) {
      const btn = domNode(TAG_BTN, CLS_PILL);
      btn.type = TAG_BTN;
      btn.textContent = LABELS[key] ?? key;
      btn.addEventListener("click", () => this.pickField(opts.field, key));
      this.buttons[opts.field].push({ key, btn });
      row.append(btn);
    }
    return row;
  }

  private makeSwatchRow(opts: {
    readonly title: string; readonly field: "skin" | "eyeColor" | "hairColor";
    readonly keys: readonly string[]; readonly palettes: Readonly<Record<string, { readonly base: string; readonly tip?: { readonly base: string } }>>;
  }): HTMLDivElement {
    const row = domNode(TAG_DIV, "ow-hero-row");
    const lbl = domNode("span", "ow-hero-lbl");
    lbl.textContent = opts.title;
    row.append(lbl);
    for (const key of opts.keys) {
      const btn = domNode(TAG_BTN, "ow-swatch");
      btn.type = TAG_BTN;
      btn.setAttribute("aria-label", `${opts.title} ${key}`);
      const pal = opts.palettes[key];
      btn.style.background = pal?.tip ? `linear-gradient(180deg, ${pal.base} 35%, ${pal.tip.base} 78%)` : (pal?.base ?? "#94a3b8");
      btn.addEventListener("click", () => this.pickField(opts.field, key));
      this.buttons[opts.field].push({ key, btn });
      row.append(btn);
    }
    return row;
  }

  private pickField(field: keyof CharacterAppearance, value: string): void {
    if (!this.currentApp) return;
    this.emitChange(this.currentName, { ...this.currentApp, [field]: value } as CharacterAppearance);
  }

  private emitChange(name: string, appearance: CharacterAppearance | null): void {
    if (!appearance) return;
    this.onUpdate({ name: name.trim() || this.currentName, appearance });
  }

  sync(opts: { readonly open: boolean; readonly name: string; readonly appearance: CharacterAppearance; readonly armor: ArmorEquipment }): void {
    this.el.hidden = !opts.open;
    if (!opts.open) return;
    this.currentName = opts.name;
    this.currentApp = opts.appearance;
    const fp = `${opts.name}#${characterCacheKey(opts.appearance, opts.armor)}#${getCharacterCacheRevision()}`;
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    if (document.activeElement !== this.nameInput) this.nameInput.value = opts.name;
    this.previewEl.src = getCharacterPortraitUrl(opts.appearance, opts.armor);
    const keys = ["body", "skin", "eyeColor", "hairStyle", "hairColor"] as const;
    for (const field of keys) syncButtonGroup(this.buttons[field], opts.appearance[field]);
  }
}

function syncButtonGroup(entries: readonly CharBtnEntry[], activeKey: string): void {
  for (const e of entries) e.btn.dataset.active = String(e.key === activeKey);
}

function buildNameInput(onChange: (name: string) => void): HTMLInputElement {
  const input = domNode("input", "ow-hero-input");
  input.type = "text";
  input.maxLength = 20;
  input.placeholder = "Adventurer";
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function buildHeader(onClose: () => void): HTMLDivElement {
  const head = domNode(TAG_DIV, "ow-modal-head");
  const title = domNode("span");
  title.textContent = "Hero Appearance";
  const closeBtn = domNode(TAG_BTN, CLS_PILL);
  closeBtn.type = TAG_BTN;
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", onClose);
  head.append(title, closeBtn);
  return head;
}
