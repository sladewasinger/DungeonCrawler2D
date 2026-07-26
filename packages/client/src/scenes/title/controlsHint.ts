import { stringsData } from "@dc2d/content";
import { titleHintLayout } from "./controlsHintLayout.js";

const UI_FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

interface TitleViewport {
  readonly innerWidth: number;
  readonly innerHeight: number;
  addEventListener(type: "resize", listener: () => void): void;
  removeEventListener(type: "resize", listener: () => void): void;
}

export function bindTitleHintLayout(
  viewport: TitleViewport,
  apply: (width: number, height: number) => void,
): () => void {
  const update = () => apply(viewport.innerWidth, viewport.innerHeight);
  viewport.addEventListener("resize", update);
  update();
  return () => viewport.removeEventListener("resize", update);
}

export class TitleControlsHint {
  private readonly root = document.createElement("section");
  private readonly tagline = document.createElement("p");
  private readonly premise = document.createElement("p");
  private readonly controls = document.createElement("p");
  private readonly stopLayout: () => void;

  constructor() {
    this.root.setAttribute("aria-label", "How to play");
    this.root.style.cssText =
      `position:fixed;left:50%;translate:-50% 0;z-index:12;box-sizing:border-box;` +
      `text-align:center;overflow-wrap:anywhere;pointer-events:none;font-family:${UI_FONT};`;
    this.tagline.textContent = stringsData.tagline;
    this.tagline.style.cssText = "margin:0 0 10px;color:#ffd23d;font-size:clamp(20px,1.5vw,26px);font-weight:700";
    this.premise.textContent = stringsData.premise;
    this.premise.style.cssText = "margin:0;color:#c6c6d2;font-size:clamp(16px,1.2vw,20px);line-height:1.45";
    this.controls.style.cssText = "margin:14px 0 0;color:#d5d5df;font-size:clamp(15px,1.1vw,18px);line-height:1.4";
    this.root.append(this.tagline, this.premise, this.controls);
    document.body.append(this.root);
    this.stopLayout = bindTitleHintLayout(window, (width, height) => this.layout(width, height));
  }

  layout(width: number, height: number): void {
    const layout = titleHintLayout(width, height);
    this.root.style.top = `${layout.topPx}px`;
    this.root.style.width = `${layout.widthPx}px`;
    this.premise.hidden = !layout.premiseVisible;
    this.controls.textContent = layout.controlsText;
  }

  dispose(): void {
    this.stopLayout();
    this.root.remove();
  }
}
