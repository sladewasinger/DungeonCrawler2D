/** Pre-game Title Screen overlay with Name input, live Hero Creator, and localhost-only Sound Studio link. */
import { EYE_PALETTES, HAIR_PALETTES, SKIN_PALETTES } from "@dc2d/content";
import {
  BODY_STYLES, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, type CharacterAppearance,
} from "@dc2d/engine";
import { getCharacterCacheRevision, getCharacterSpriteSet } from "../../render/character/characterSprites.js";
import { domNode } from "../hud/slotRenderer.js";
import { ensureTitleStyles } from "./titleStyles.js";

declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;

const EMPTY_ARMOR = { head: null, chest: null, legs: null, feet: null, offhand: null } as const;
const OPTION_LABELS: Readonly<Record<string, string>> = {
  male: "Male", female: "Female", short: "Short", long: "Long", spiky: "Spiky", ponytail: "Ponytail", bald: "Bald",
};

const TAG_DIV = "div";
const TAG_BTN = "button";

export function isLocalhostOrigin(hostname = window.location.hostname): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export interface TitleScreenOptions {
  readonly initialName: string;
  readonly initialAppearance: CharacterAppearance;
  readonly onPreviewChange: (req: { readonly name: string; readonly appearance: CharacterAppearance }) => void;
  readonly onEnterWorld: (req: { readonly name: string; readonly appearance: CharacterAppearance }) => void;
}

interface TitleBtnGroup { readonly key: string; readonly btn: HTMLButtonElement }

export class TitleScreen {
  private readonly root: HTMLDivElement;
  private readonly portrait: HTMLImageElement;
  private readonly nameInput: HTMLInputElement;
  private readonly groups: Record<"body" | "skin" | "eyeColor" | "hairStyle" | "hairColor", TitleBtnGroup[]> = {
    body: [], skin: [], eyeColor: [], hairStyle: [], hairColor: [],
  };
  private name: string;
  private appearance: CharacterAppearance;
  private open = true;
  private lastCacheRev = -1;
  private readonly assetPollId: number;

  constructor(private readonly host: HTMLElement, private readonly opts: TitleScreenOptions) {
    ensureTitleStyles();
    this.name = opts.initialName;
    this.appearance = opts.initialAppearance;
    this.host.dataset.titleOpen = "true";
    this.root = domNode(TAG_DIV, "ow-title-backdrop");
    this.portrait = domNode("img", "ow-title-portrait");
    this.portrait.alt = "Hero Preview";
    this.nameInput = this.buildNameInput(opts.initialName);
    const card = domNode(TAG_DIV, "ow-title-card");
    card.append(this.buildHeader(), this.buildHeroRow(), this.buildCustomizer(), this.buildEnterButton(), this.buildFooter());
    this.root.append(card);
    host.append(this.root);
    this.refreshPreview();
    this.assetPollId = window.setInterval(() => {
      if (this.open && getCharacterCacheRevision() !== this.lastCacheRev) this.refreshPreview();
    }, 200);
  }

  isOpen(): boolean { return this.open; }

  dismiss(): void {
    this.open = false;
    window.clearInterval(this.assetPollId);
    this.root.hidden = true;
    delete this.host.dataset.titleOpen;
  }

  private buildNameInput(initial: string): HTMLInputElement {
    const input = domNode("input", "ow-title-name");
    input.type = "text";
    input.maxLength = 20;
    input.value = initial;
    input.placeholder = "Adventurer";
    input.addEventListener("input", () => {
      this.name = input.value.trim() || "Adventurer";
      this.opts.onPreviewChange({ name: this.name, appearance: this.appearance });
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.submitEnter(); }
    });
    return input;
  }

  private buildHeader(): HTMLDivElement {
    const box = domNode(TAG_DIV, "ow-title-header");
    const h1 = domNode("h1", "ow-title-heading");
    h1.textContent = "Dungeon Crawler 2D";
    const sub = domNode("p", "ow-title-sub");
    sub.textContent = "Verdant Overworld · Multiplayer Action-RPG";
    box.append(h1, sub);
    return box;
  }

  private buildHeroRow(): HTMLDivElement {
    const row = domNode(TAG_DIV, "ow-title-hero-row");
    const wrap = domNode(TAG_DIV, "ow-title-name-box");
    const lbl = domNode("label", "ow-title-label");
    lbl.textContent = "Hero Name";
    wrap.append(lbl, this.nameInput);
    row.append(this.portrait, wrap);
    return row;
  }

  private buildCustomizer(): HTMLDivElement {
    const form = domNode(TAG_DIV, "ow-hero-form");
    form.append(
      this.makeOptionRow("Body", "body", BODY_STYLES),
      this.makeSwatchRow({ title: "Skin", field: "skin", keys: SKIN_TONES, palettes: SKIN_PALETTES }),
      this.makeSwatchRow({ title: "Eyes", field: "eyeColor", keys: EYE_COLORS, palettes: EYE_PALETTES }),
      this.makeOptionRow("Hair", "hairStyle", HAIR_STYLES),
      this.makeSwatchRow({ title: "Color", field: "hairColor", keys: HAIR_COLORS, palettes: HAIR_PALETTES }),
    );
    return form;
  }

  private makeOptionRow(title: string, field: "body" | "hairStyle", keys: readonly string[]): HTMLDivElement {
    const row = domNode(TAG_DIV, "ow-hero-row");
    const lbl = domNode("span", "ow-hero-lbl");
    lbl.textContent = title;
    row.append(lbl);
    for (const key of keys) {
      const btn = domNode(TAG_BTN, "ow-pill");
      btn.type = TAG_BTN;
      btn.textContent = OPTION_LABELS[key] ?? key;
      btn.addEventListener("click", () => this.selectField(field, key));
      this.groups[field].push({ key, btn });
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
      btn.addEventListener("click", () => this.selectField(opts.field, key));
      this.groups[opts.field].push({ key, btn });
      row.append(btn);
    }
    return row;
  }

  private selectField(field: keyof CharacterAppearance, value: string): void {
    this.appearance = { ...this.appearance, [field]: value } as CharacterAppearance;
    this.refreshPreview();
    this.opts.onPreviewChange({ name: this.name, appearance: this.appearance });
  }

  private refreshPreview(): void {
    this.lastCacheRev = getCharacterCacheRevision();
    this.portrait.src = getCharacterSpriteSet(this.appearance, EMPTY_ARMOR).previewUrl;
    const fields = ["body", "skin", "eyeColor", "hairStyle", "hairColor"] as const;
    for (const field of fields) {
      for (const e of this.groups[field]) e.btn.dataset.active = String(e.key === this.appearance[field]);
    }
  }

  private buildEnterButton(): HTMLButtonElement {
    const btn = domNode(TAG_BTN, "ow-title-enter");
    btn.type = TAG_BTN;
    btn.textContent = "Enter World";
    btn.addEventListener("click", () => this.submitEnter());
    return btn;
  }

  private submitEnter(): void {
    this.name = this.nameInput.value.trim() || "Adventurer";
    this.opts.onEnterWorld({ name: this.name, appearance: this.appearance });
  }

  private buildFooter(): HTMLDivElement {
    const foot = domNode(TAG_DIV, "ow-title-footer");
    const ver = domNode("span");
    ver.textContent = `v${__APP_VERSION__} (${__BUILD_SHA__})`;
    foot.append(ver);
    if (isLocalhostOrigin()) {
      const links = domNode(TAG_DIV, "ow-title-links");
      links.append(
        makeFooterLink("Asset Sandbox", "/?sandbox=1", "_self"),
        makeFooterLink("Sound Studio", "/sound-studio.html", "_blank"),
      );
      foot.append(links);
    }
    return foot;
  }
}

function makeFooterLink(label: string, href: string, target: "_self" | "_blank"): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "ow-studio-link";
  link.href = href;
  if (target === "_blank") { link.target = target; link.rel = "noopener"; }
  link.textContent = label;
  return link;
}
