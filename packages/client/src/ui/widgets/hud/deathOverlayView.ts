import type Phaser from "phaser";

import { uiTextStyle } from "../../font.js";

import type { Viewport } from "../state.js";


export const HOLD_BAR_WIDTH = 220;

export const HOLD_BAR_HEIGHT = 10;

export const GIVE_UP_BUTTON_HEIGHT = 30;

export const DEATH_HEADLINE_COLOR = "#ff304f";

export const DEATH_HEADLINE_OUTLINE = "#240109";


export interface DeathOverlayPresentation {
  headlineSize: number;

detailSize: number;

headlineY: number;

timerY: number;

  promptY: number;

barY: number;

barWidth: number;

buttonY: number;

buttonWidth: number;

}

export function deathOverlayPresentation(viewport: Viewport, scale = 1): DeathOverlayPresentation {
  const width = viewport.width / Math.max(1, scale);

  const height = viewport.height / Math.max(1, scale);

  const headlineSize = Math.min(64, width / 4.8, height * 0.25);

  const detailSize = Math.min(20, width / 20, height * 0.09);

  const gap = Math.max(3, Math.min(10, height * 0.04));

  const headlineHeight = headlineSize * 1.15;

  const detailHeight = detailSize * 1.25;

  const top = -(headlineHeight + detailHeight * 2 + gap * 4 + HOLD_BAR_HEIGHT + GIVE_UP_BUTTON_HEIGHT) / 2;

  return {
    headlineSize, detailSize, headlineY: top + headlineHeight / 2,
    timerY: top + headlineHeight + gap + detailHeight / 2,
    promptY: top + headlineHeight + gap * 2 + detailHeight * 1.5,
    barY: top + headlineHeight + gap * 3 + detailHeight * 2 + HOLD_BAR_HEIGHT / 2,
    barWidth: Math.min(HOLD_BAR_WIDTH, Math.max(88, width - 32)),
    buttonY: top + headlineHeight + gap * 4 + detailHeight * 2 + HOLD_BAR_HEIGHT + GIVE_UP_BUTTON_HEIGHT / 2,
    buttonWidth: Math.min(180, Math.max(96, width - 48)),
  };

}

export interface DeathOverlayParts {
  headline: Phaser.GameObjects.Text;

timer: Phaser.GameObjects.Text;

prompt: Phaser.GameObjects.Text;

  holdBar: Phaser.GameObjects.Rectangle;

holdFill: Phaser.GameObjects.Rectangle;

  giveUpButton: Phaser.GameObjects.Rectangle;

giveUpLabel: Phaser.GameObjects.Text;

}

export function createDeathOverlayParts(request: { scene: Phaser.Scene;

presentation: DeathOverlayPresentation;

scale: number;

onGiveUp: () => void }): DeathOverlayParts {
  const { scene, presentation, scale, onGiveUp } = request;

  const headline = scene.add.text(0, presentation.headlineY, "YOU DIED", {
    ...uiTextStyle(presentation.headlineSize, DEATH_HEADLINE_COLOR, { scale, weight: "emphasis" }),
    stroke: DEATH_HEADLINE_OUTLINE, strokeThickness: 7,
    shadow: { offsetX: 0, offsetY: 4, color: "#000000", blur: 6, fill: true },
  }).setOrigin(0.5).setAlign("center");

  const timer = scene.add.text(0, presentation.timerY, deathTimerText(5), uiTextStyle(presentation.detailSize, "#f2e9e2", { scale, weight: "emphasis" })).setOrigin(0.5);

  const prompt = scene.add.text(0, presentation.promptY, "", uiTextStyle(presentation.detailSize, "#f2e9e2", { scale })).setOrigin(0.5).setAlign("center");

  const holdBar = scene.add.rectangle(0, presentation.barY, presentation.barWidth, HOLD_BAR_HEIGHT, 0x242436).setStrokeStyle(2, 0x77778d);

  const holdFill = scene.add.rectangle(-presentation.barWidth / 2, presentation.barY, 0, HOLD_BAR_HEIGHT - 2, 0xffd23d).setOrigin(0, 0.5);

  const giveUpButton = scene.add.rectangle(0, presentation.buttonY, presentation.buttonWidth, GIVE_UP_BUTTON_HEIGHT, 0xb51631).setStrokeStyle(2, 0xff6b7f).setInteractive({ useHandCursor: true });

  giveUpButton.on("pointerup", (...args: unknown[]) => { (args[3] as { stopPropagation(): void }).stopPropagation();

onGiveUp();

});

  const giveUpLabel = scene.add.text(0, presentation.buttonY, "Give Up", uiTextStyle(presentation.detailSize, "#ffffff", { scale, weight: "emphasis" })).setOrigin(0.5);

  return { headline, timer, prompt, holdBar, holdFill, giveUpButton, giveUpLabel };

}

export const giveUpButtonVisible = (downed: boolean, dead: boolean): boolean => downed && !dead;

export const deathOverlayText = (remainingSec: number): string => `YOU DIED\n${deathTimerText(remainingSec)}`;

export const deathTimerText = (remainingSec: number): string => `Respawning in ${Math.max(0, Math.ceil(remainingSec))}s`;

export const downedOverlayText = (remainingSec: number, reviverName: string | null): string =>
  `DOWNED\nBleeding out in ${Math.max(0, Math.ceil(remainingSec))}s\n${reviverName ? `${reviverName} is reviving you` : "Hold [E] for 2s to give up\nAny nearby player can revive you"}`;

export function barPresentation(request: { downed: boolean;

hold: number;

revive: number }): { progress: number;

visible: boolean } {
  const progress = request.downed ? Math.max(request.hold, request.revive) : 0;

  return { progress, visible: request.downed && progress > 0 };

}
