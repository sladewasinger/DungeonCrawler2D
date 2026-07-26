/**
 * Death/downed overlay HUD widget: a dark vignette + centered respawn text, hidden
 * unless the player is downed. Sized to the viewport, but still registry-anchored at
 * "center" so its screen coverage stays a resolved layout, not a hardcoded rect.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "death";
const VIGNETTE_COLOR = 0x0a0a10;
const VIGNETTE_ALPHA = 0.72;
const HOLD_BAR_WIDTH = 220;
const HOLD_BAR_HEIGHT = 10;
const GIVE_UP_BUTTON_HEIGHT = 30;
export const DEATH_HEADLINE_COLOR = "#ff304f";
export const DEATH_HEADLINE_OUTLINE = "#240109";

export function deathOverlayPresentation(viewport: Viewport, scale = 1) {
  const width = viewport.width / Math.max(1, scale);
  const height = viewport.height / Math.max(1, scale);
  const headlineSize = Math.min(64, width / 4.8, height * 0.25);
  const detailSize = Math.min(20, width / 20, height * 0.09);
  const gap = Math.max(3, Math.min(10, height * 0.04));
  const headlineHeight = headlineSize * 1.15;
  const detailHeight = detailSize * 1.25;
  const total = headlineHeight + detailHeight * 2 + gap * 4 +
    HOLD_BAR_HEIGHT + GIVE_UP_BUTTON_HEIGHT;
  const top = -total / 2;
  return {
    headlineSize,
    detailSize,
    headlineY: top + headlineHeight / 2,
    timerY: top + headlineHeight + gap + detailHeight / 2,
    promptY: top + headlineHeight + gap * 2 + detailHeight * 1.5,
    barY: top + headlineHeight + gap * 3 + detailHeight * 2 + HOLD_BAR_HEIGHT / 2,
    barWidth: Math.min(HOLD_BAR_WIDTH, Math.max(88, width - 32)),
    buttonY: top + headlineHeight + gap * 4 + detailHeight * 2 +
      HOLD_BAR_HEIGHT + GIVE_UP_BUTTON_HEIGHT / 2,
    buttonWidth: Math.min(180, Math.max(96, width - 48)),
  };
}

export const giveUpButtonVisible = (downed: boolean, dead: boolean): boolean =>
  downed && !dead;

function createGiveUpButton(
  scene: Phaser.Scene,
  presentation: ReturnType<typeof deathOverlayPresentation>,
  scale: number,
  onGiveUp: () => void,
) {
  const button = scene.add.rectangle(
    0, presentation.buttonY, presentation.buttonWidth,
    GIVE_UP_BUTTON_HEIGHT, 0xb51631,
  ).setStrokeStyle(2, 0xff6b7f).setInteractive({ useHandCursor: true })
    .on("pointerup", (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: { stopPropagation(): void },
    ) => {
      event.stopPropagation();
      onGiveUp();
    });
  const label = scene.add.text(
    0, presentation.buttonY, "Give Up",
    uiTextStyle(presentation.detailSize, "#ffffff", scale, "emphasis"),
  ).setOrigin(0.5);
  return { button, label };
}

function createDeathOverlayParts(
  scene: Phaser.Scene,
  presentation: ReturnType<typeof deathOverlayPresentation>,
  scale: number,
) {
  const headline = scene.add
    .text(0, presentation.headlineY, "YOU DIED", {
      ...uiTextStyle(presentation.headlineSize, DEATH_HEADLINE_COLOR, scale, "emphasis"),
      stroke: DEATH_HEADLINE_OUTLINE,
      strokeThickness: 7,
      shadow: { offsetX: 0, offsetY: 4, color: "#000000", blur: 6, fill: true },
    })
    .setOrigin(0.5, 0.5)
    .setAlign("center");
  const timer = scene.add.text(0, presentation.timerY, deathTimerText(5),
    uiTextStyle(presentation.detailSize, "#f2e9e2", scale, "emphasis")).setOrigin(0.5);
  const prompt = scene.add.text(0, presentation.promptY, "",
    uiTextStyle(presentation.detailSize, "#f2e9e2", scale)).setOrigin(0.5).setAlign("center");
  const holdBar = scene.add.rectangle(
    0, presentation.barY, presentation.barWidth, HOLD_BAR_HEIGHT, 0x242436,
  ).setStrokeStyle(2, 0x77778d);
  const holdFill = scene.add.rectangle(
    -presentation.barWidth / 2, presentation.barY, 0, HOLD_BAR_HEIGHT - 2, 0xffd23d,
  ).setOrigin(0, 0.5);
  return { headline, timer, prompt, holdBar, holdFill };
}

function barPresentation(downed: boolean, _dead: boolean, hold: number, revive: number) {
  const progress = downed ? Math.max(hold, revive) : 0;
  return { progress, visible: downed && progress > 0 };
}

export const deathOverlayText = (remainingSec: number): string =>
  `YOU DIED\nRespawning in ${Math.max(0, Math.ceil(remainingSec))}s`;
const deathTimerText = (remainingSec: number): string =>
  `Respawning in ${Math.max(0, Math.ceil(remainingSec))}s`;

export const downedOverlayText = (remainingSec: number, reviverName: string | null): string =>
  `DOWNED\nBleeding out in ${Math.max(0, Math.ceil(remainingSec))}s\n` +
  (reviverName ? `${reviverName} is reviving you` : "Hold [E] for 2s to give up\nAny nearby player can revive you");

export class DeathOverlayWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly vignette: Phaser.GameObjects.Rectangle;
  private readonly headline: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly holdBar: Phaser.GameObjects.Rectangle;
  private readonly holdFill: Phaser.GameObjects.Rectangle;
  private readonly giveUpButton: Phaser.GameObjects.Rectangle;
  private readonly giveUpLabel: Phaser.GameObjects.Text;
  private barWidth = HOLD_BAR_WIDTH;

  constructor(
    scene: Phaser.Scene,
    registry: WidgetRegistry,
    viewport: Viewport,
    onGiveUp: () => void = () => {},
  ) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "center",
      defaultOffset: { x: 0, y: 0 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (!layout) throw new Error("death widget layout was not registered");
    const presentation = deathOverlayPresentation(viewport, layout.scale);
    this.barWidth = presentation.barWidth;
    this.container = createWidgetContainer(scene, layout);
    this.vignette = scene.add.rectangle(0, 0, viewport.width, viewport.height, VIGNETTE_COLOR, VIGNETTE_ALPHA);
    const parts = createDeathOverlayParts(scene, presentation, layout.scale);
    this.headline = parts.headline;
    this.timer = parts.timer;
    this.prompt = parts.prompt;
    this.holdBar = parts.holdBar;
    this.holdFill = parts.holdFill;
    const giveUp = createGiveUpButton(
      scene, presentation, layout.scale, onGiveUp,
    );
    this.giveUpButton = giveUp.button;
    this.giveUpLabel = giveUp.label;
    this.container.add([
      this.vignette, this.headline, this.timer, this.prompt, this.holdBar,
      this.holdFill, this.giveUpButton, this.giveUpLabel,
    ]);
    this.container.setVisible(false);
  }

  update(
    downed: boolean,
    dead: boolean,
    remainingSec: number,
    holdProgress: number,
    downedRemainingSec = 15,
    reviveProgress = 0,
    reviverName: string | null = null,
  ): void {
    this.container.setVisible(downed || dead);
    const downedCopy = downedOverlayText(downedRemainingSec, reviverName).split("\n");
    this.headline.setText(downed ? downedCopy[0] ?? "DOWNED" : "YOU DIED");
    this.timer.setText(downed ? downedCopy[1] ?? "" : deathTimerText(remainingSec));
    this.prompt.setText(downed ? downedCopy.slice(2).join("\n") : "");
    const bar = barPresentation(downed, dead, holdProgress, reviveProgress);
    const buttonVisible = giveUpButtonVisible(downed, dead);
    this.giveUpButton.setVisible(buttonVisible);
    this.giveUpLabel.setVisible(buttonVisible);
    this.holdBar.setVisible(bar.visible);
    this.holdFill.setVisible(bar.visible)
      .setDisplaySize(this.barWidth * Math.min(1, Math.max(0, bar.progress)), HOLD_BAR_HEIGHT - 2);
  }

  /** Resizes the vignette to cover the new viewport, then re-syncs the container position. */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    this.vignette.setSize(viewport.width, viewport.height);
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) {
      syncWidgetContainer(this.container, layout);
      const p = deathOverlayPresentation(viewport, layout.scale);
      this.barWidth = p.barWidth;
      this.headline.setFontSize(p.headlineSize).setY(p.headlineY);
      this.timer.setFontSize(p.detailSize).setY(p.timerY);
      this.prompt.setFontSize(p.detailSize).setY(p.promptY);
      this.holdBar.setPosition(0, p.barY).setSize(p.barWidth, HOLD_BAR_HEIGHT);
      this.holdFill.setPosition(-p.barWidth / 2, p.barY);
      this.giveUpButton.setPosition(0, p.buttonY)
        .setSize(p.buttonWidth, GIVE_UP_BUTTON_HEIGHT);
      this.giveUpLabel.setPosition(0, p.buttonY).setFontSize(p.detailSize);
    }
  }
}
