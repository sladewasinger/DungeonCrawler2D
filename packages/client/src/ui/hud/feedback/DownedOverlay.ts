/** Owns the first-person downed/death message without adding layout logic to Hud. */
import type { Connection } from "../../../net/connection/connection.js";
import {
  deathOverlayText,
  downedOverlayText,
  giveUpButtonVisible,
} from "../../../ui/widgets/hud/notices/deathOverlay.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

const HOLD_BAR_WIDTH = 220;

function syncGiveUpButton(
  button: HTMLButtonElement,
  visible: boolean,
  wasVisible: boolean,
): boolean {
  button.hidden = !visible;
  button.style.display = visible ? "block" : "none";
  if (visible && !wasVisible) document.exitPointerLock?.();
  return visible;
}

export class DownedOverlay {
  readonly element = createHudTemplate<HTMLDivElement>("hud-downed-template");
  readonly copy = requireHudElement<HTMLDivElement>(this.element, "[data-hud-downed-copy]");
  readonly headline = requireHudElement<HTMLDivElement>(this.element, "[data-hud-downed-headline]");
  readonly fill = requireHudElement<HTMLDivElement>(this.element, "[data-hud-downed-fill]");
  readonly giveUpButton = requireHudElement<HTMLButtonElement>(this.element, "[data-hud-downed-give-up]");
  private giveUpVisible = false;

  constructor(parent: HTMLElement, onGiveUp: () => void = () => {}) {
    this.giveUpButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onGiveUp();
    });
    parent.append(this.element);
  }

  update(connection: Connection, holdProgress = 0): void {
    const visible = connection.downed || connection.dead;
    this.element.hidden = !visible;
    const text = overlayText(connection);
    const [headline, ...detail] = text.split("\n");
    this.headline.textContent = headline ?? "";
    this.copy.textContent = detail.join("\n");
    const progress = downedProgress(connection, holdProgress);
    const track = this.fill.parentElement;
    if (track) track.hidden = !connection.downed || progress <= 0;
    const buttonVisible = giveUpButtonVisible(
      connection.downed,
      connection.dead,
    );
    this.giveUpVisible = syncGiveUpButton(
      this.giveUpButton,
      buttonVisible,
      this.giveUpVisible,
    );
    this.fill.style.width = `${HOLD_BAR_WIDTH * Math.min(1, Math.max(0, progress))}px`;
  }
}

const overlayText = (connection: Connection): string => connection.downed
  ? downedOverlayText(connection.downedSecondsRemaining, connection.reviverName)
  : deathOverlayText(connection.respawnSecondsRemaining);

const downedProgress = (connection: Connection, holdProgress: number): number =>
  connection.downed ? Math.max(connection.reviveProgress, holdProgress) : 0;
