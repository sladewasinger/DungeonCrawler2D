import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_PLAYER_MODEL,
  PLAYER_GENDERS,
  PLAYER_MODELS,
  isPlayerSkin,
  playerSkin,
  type PlayerGender,
  type PlayerModel,
  type PlayerSkin,
} from "@dc2d/engine";
import { ASSET_PATHS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { loadTabPreference, saveTabPreference } from "../../net/auth/identity.js";

const STORAGE_KEY = "dc2d-player-skin";
const ATLAS_WIDTH = 512;
const ATLAS_HEIGHT = 594;

const FRAME_Y: Record<PlayerModel, Record<PlayerGender, number>> = {
  knight: { female: 68, male: 100 },
  elf: { female: 4, male: 36 },
  wizzard: { female: 132, male: 164 },
  lizard: { female: 196, male: 228 },
  dwarf: { female: 260, male: 292 },
};

const MODEL_LABELS: Record<PlayerModel, string> = {
  knight: "Knight",
  elf: "Elf",
  wizzard: "Wizard",
  lizard: "Lizard",
  dwarf: "Dwarf",
};

function storedSelection(): {
  gender: PlayerGender;
  model: PlayerModel;
} {
  const stored = loadTabPreference(STORAGE_KEY);
  if (!isPlayerSkin(stored)) {
    return { gender: DEFAULT_PLAYER_GENDER, model: DEFAULT_PLAYER_MODEL };
  }
  const [model, suffix] = stored.split("_");
  return {
    model: model as PlayerModel,
    gender: suffix === "m" ? "male" : "female",
  };
}

function preview(model: PlayerModel, gender: PlayerGender): HTMLSpanElement {
  const element = document.createElement("span");
  const scale = WORLD_PIXEL_SCALE;
  element.className = "character-preview";
  element.style.backgroundImage = `url("${ASSET_PATHS.atlasImage}")`;
  element.style.backgroundSize =
    `${ATLAS_WIDTH * scale}px ${ATLAS_HEIGHT * scale}px`;
  element.style.backgroundPosition =
    `${-128 * scale}px ${-FRAME_Y[model][gender] * scale}px`;
  return element;
}

export class CharacterSelection {
  readonly element = document.createElement("section");
  private gender: PlayerGender = DEFAULT_PLAYER_GENDER;
  private model: PlayerModel = DEFAULT_PLAYER_MODEL;
  private readonly genderButtons = new Map<PlayerGender, HTMLButtonElement>();
  private readonly modelButtons = new Map<PlayerModel, HTMLButtonElement>();

  constructor() {
    const stored = storedSelection();
    this.gender = stored.gender;
    this.model = stored.model;
    this.element.className = "character-selection";
    this.element.setAttribute("aria-label", "Character appearance");
    this.element.append(
      this.heading("Choose your crawler"),
      this.genderChoices(),
      this.modelChoices(),
    );
    this.refresh();
  }

  get skin(): PlayerSkin {
    return playerSkin(this.model, this.gender);
  }

  setBusy(busy: boolean): void {
    for (const button of [
      ...this.genderButtons.values(),
      ...this.modelButtons.values(),
    ]) button.disabled = busy;
  }

  private heading(text: string): HTMLHeadingElement {
    const heading = document.createElement("h2");
    heading.textContent = text;
    return heading;
  }

  private genderChoices(): HTMLDivElement {
    const group = document.createElement("div");
    group.className = "character-genders";
    for (const gender of PLAYER_GENDERS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = gender === "female" ? "Girl" : "Guy";
      button.addEventListener("click", () => {
        this.gender = gender;
        this.persistAndRefresh();
      });
      this.genderButtons.set(gender, button);
      group.append(button);
    }
    return group;
  }

  private modelChoices(): HTMLDivElement {
    const group = document.createElement("div");
    group.className = "character-models";
    for (const model of PLAYER_MODELS) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", MODEL_LABELS[model]);
      button.addEventListener("click", () => {
        this.model = model;
        this.persistAndRefresh();
      });
      this.modelButtons.set(model, button);
      group.append(button);
    }
    return group;
  }

  private persistAndRefresh(): void {
    saveTabPreference(STORAGE_KEY, this.skin);
    this.refresh();
  }

  private refresh(): void {
    for (const [gender, button] of this.genderButtons) {
      button.classList.toggle("selected", gender === this.gender);
      button.setAttribute("aria-pressed", String(gender === this.gender));
    }
    for (const [model, button] of this.modelButtons) {
      button.replaceChildren(
        preview(model, this.gender),
        document.createTextNode(MODEL_LABELS[model]),
      );
      button.classList.toggle("selected", model === this.model);
      button.setAttribute("aria-pressed", String(model === this.model));
    }
  }
}
