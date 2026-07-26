import {
  createGraphicsControls,
  createSessionButton,
} from "./SessionMenuControls.js";
import type { LocalPresentationController } from "./localPresentation.js";

type AdvancedTab = "graphics" | "gameplay";

interface AdvancedSettingsOptions {
  readonly presentation: LocalPresentationController;
  readonly replayTutorials?: (() => void) | undefined;
  readonly onBack: () => void;
}

function createSectionTitle(text: string): HTMLHeadingElement {
  const title = document.createElement("h2");
  title.textContent = text;
  title.style.cssText = "margin:0;color:#ffd54c;font-size:20px";
  return title;
}

function createTabButton(
  label: string,
  select: () => void,
): HTMLButtonElement {
  const button = createSessionButton(label, select);
  button.setAttribute("role", "tab");
  button.style.width = "auto";
  button.style.minWidth = "120px";
  return button;
}

export class AdvancedSettingsDialog {
  readonly element = document.createElement("div");
  private readonly graphicsButton: HTMLButtonElement;
  private readonly gameplayButton: HTMLButtonElement;
  private readonly graphics = document.createElement("div");
  private readonly gameplay = document.createElement("div");

  constructor(options: AdvancedSettingsOptions) {
    this.element.style.cssText = "display:none;gap:14px";
    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:12px";
    const back = createSessionButton("Back", options.onBack);
    back.style.width = "auto";
    header.append(createSectionTitle("Advanced settings"), back);
    const tabs = document.createElement("div");
    tabs.setAttribute("role", "tablist");
    tabs.style.cssText = "display:flex;gap:8px;border-bottom:1px solid #4d5168;padding-bottom:8px";
    this.graphicsButton = createTabButton("Graphics", () => this.select("graphics"));
    this.gameplayButton = createTabButton("Gameplay", () => this.select("gameplay"));
    tabs.append(this.graphicsButton, this.gameplayButton);
    this.configurePanels(options);
    this.element.append(header, tabs, this.graphics, this.gameplay);
    this.select("graphics");
  }

  open(): void {
    this.element.style.display = "grid";
    this.select("graphics");
    this.graphicsButton.focus({ preventScroll: true });
  }

  close(): void {
    this.element.style.display = "none";
  }

  get isOpen(): boolean {
    return this.element.style.display === "grid";
  }

  private configurePanels(options: AdvancedSettingsOptions): void {
    this.graphics.setAttribute("role", "tabpanel");
    this.graphics.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));" +
      "gap:12px;align-items:start";
    this.graphics.append(...createGraphicsControls(options.presentation));
    this.gameplay.setAttribute("role", "tabpanel");
    this.gameplay.style.cssText = "display:none;gap:10px";
    this.gameplay.append(createSectionTitle("Gameplay"));
    if (options.replayTutorials) {
      this.gameplay.append(createSessionButton(
        "Replay tutorial hints",
        options.replayTutorials,
      ));
    }
  }

  private select(tab: AdvancedTab): void {
    const graphics = tab === "graphics";
    this.graphics.style.display = graphics
      ? "grid"
      : "none";
    this.gameplay.style.display = graphics
      ? "none"
      : "grid";
    this.setTabState(this.graphicsButton, graphics);
    this.setTabState(this.gameplayButton, !graphics);
  }

  private setTabState(button: HTMLButtonElement, selected: boolean): void {
    button.setAttribute("aria-selected", String(selected));
    button.style.borderColor = selected ? "#ffd54c" : "#757a93";
    button.style.color = selected ? "#ffd54c" : "#f2f0eb";
  }
}
