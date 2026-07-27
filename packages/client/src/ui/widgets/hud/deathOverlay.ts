import type Phaser from "phaser";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { barPresentation, createDeathOverlayParts, deathOverlayPresentation, deathTimerText, downedOverlayText, giveUpButtonVisible, GIVE_UP_BUTTON_HEIGHT, HOLD_BAR_HEIGHT, HOLD_BAR_WIDTH } from "./deathOverlayView.js";
export { DEATH_HEADLINE_COLOR, DEATH_HEADLINE_OUTLINE, deathOverlayPresentation, deathOverlayText, downedOverlayText, giveUpButtonVisible } from "./deathOverlayView.js";
const WIDGET_ID = "death";
const VIGNETTE_COLOR = 0x0a0a10;
const VIGNETTE_ALPHA = 0.72;
export interface DeathOverlayOptions {
    scene: Phaser.Scene;
    registry: WidgetRegistry;
    viewport: Viewport;
    onGiveUp?: () => void;
}
export interface DeathOverlayState {
    downed: boolean;
    dead: boolean;
    remainingSec: number;
    holdProgress: number;
    downedRemainingSec?: number;
    reviveProgress?: number;
    reviverName?: string | null;
}
export interface DeathOverlayCopy {
    headline: string;
    timer: string;
    prompt: string;
}
export function deathOverlayCopy(state: DeathOverlayState): DeathOverlayCopy { const downedCopy = downedOverlayText(state.downedRemainingSec ?? 15, state.reviverName ?? null).split("\n");
return state.downed ? { headline: downedCopy[0] ?? "DOWNED", timer: downedCopy[1] ?? "", prompt: downedCopy.slice(2).join("\n") } : { headline: "YOU DIED", timer: deathTimerText(state.remainingSec), prompt: "" };
}
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
    constructor({ scene, registry, viewport, onGiveUp = () => { } }: DeathOverlayOptions) { registry.register({ id: WIDGET_ID, defaultAnchor: "center", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible: true, });
const layout = registry.resolve(viewport).get(WIDGET_ID);
if (!layout)
        throw new Error("death widget layout was not registered");
const presentation = deathOverlayPresentation(viewport, layout.scale);
this.barWidth = presentation.barWidth;
this.container = createWidgetContainer(scene, layout);
this.vignette = scene.add.rectangle(0, 0, viewport.width, viewport.height, VIGNETTE_COLOR, VIGNETTE_ALPHA);
const parts = createDeathOverlayParts({ scene, presentation, scale: layout.scale, onGiveUp });
this.headline = parts.headline;
this.timer = parts.timer;
this.prompt = parts.prompt;
this.holdBar = parts.holdBar;
this.holdFill = parts.holdFill;
this.giveUpButton = parts.giveUpButton;
this.giveUpLabel = parts.giveUpLabel;
this.container.add([this.vignette, this.headline, this.timer, this.prompt, this.holdBar, this.holdFill, this.giveUpButton, this.giveUpLabel,]);
this.container.setVisible(false);
}
    update({ downed, dead, remainingSec, holdProgress, downedRemainingSec = 15, reviveProgress = 0, reviverName = null }: DeathOverlayState): void { this.container.setVisible(downed || dead);
const copy = deathOverlayCopy({ downed, dead, remainingSec, holdProgress, downedRemainingSec, reviveProgress, reviverName });
this.headline.setText(copy.headline);
this.timer.setText(copy.timer);
this.prompt.setText(copy.prompt);
const bar = barPresentation({ downed, hold: holdProgress, revive: reviveProgress });
const buttonVisible = giveUpButtonVisible(downed, dead);
this.giveUpButton.setVisible(buttonVisible);
this.giveUpLabel.setVisible(buttonVisible);
this.holdBar.setVisible(bar.visible);
this.holdFill.setVisible(bar.visible).setDisplaySize(this.barWidth * Math.min(1, Math.max(0, bar.progress)), HOLD_BAR_HEIGHT - 2);
}
    resize(registry: WidgetRegistry, viewport: Viewport): void { this.vignette.setSize(viewport.width, viewport.height);
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
        this.giveUpButton.setPosition(0, p.buttonY).setSize(p.buttonWidth, GIVE_UP_BUTTON_HEIGHT);
        this.giveUpLabel.setPosition(0, p.buttonY).setFontSize(p.detailSize);
    } }
}
