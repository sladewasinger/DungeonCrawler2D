import { stringsData } from "@dc2d/content";
import { titleHintContent } from "./controlsHintLayout.js";

const UI_FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export class TitleControlsHint {
  private readonly root = document.createElement("section");
  private readonly tagline = document.createElement("p");
  private readonly premise = document.createElement("p");
  private readonly controls = document.createElement("p");

  constructor() {
    this.root.setAttribute("aria-label", "How to play");
    this.root.style.cssText =
      `position:fixed;left:50%;translate:-50% 0;z-index:3;width:min(780px,calc(100vw - 48px));` +
      `text-align:center;pointer-events:none;font-family:${UI_FONT};`;
    this.tagline.textContent = stringsData.tagline;
    this.tagline.style.cssText = "margin:0 0 10px;color:#ffd23d;font-size:clamp(20px,1.5vw,26px);font-weight:700";
    this.premise.textContent = stringsData.premise;
    this.premise.style.cssText = "margin:0;color:#c6c6d2;font-size:clamp(16px,1.2vw,20px);line-height:1.45";
    this.controls.style.cssText = "margin:14px 0 0;color:#d5d5df;font-size:clamp(15px,1.1vw,18px);line-height:1.4";
    this.root.append(this.tagline, this.premise, this.controls);
    document.body.append(this.root);
    this.layout(window.innerWidth, window.innerHeight);
  }

  layout(_width: number, height: number): void {
    const content = titleHintContent(height);
    this.root.style.top = `${Math.round(height * 0.34)}px`;
    this.premise.hidden = !content.premiseVisible;
    this.controls.textContent = content.controlsText;
  }

  dispose(): void {
    this.root.remove();
  }
}
