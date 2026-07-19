/**
 * HUD overlay scene: runs in parallel with the game scene on its own camera, so
 * world lighting postFX (vignette/bloom, docs/VISUAL_DIRECTION.md "darkness is the
 * canvas") never dims or blurs UI legibility. Two ways in: launched with a `source`
 * (DungeonScene, real net/inventory state pulled fresh every frame) or self-gated on
 * ?hud=1|death (the gallery's fake-data preview) — a no-op scene otherwise, so it's
 * safe to always keep launched.
 */
import Phaser from "phaser";
import { fakeHudSnapshot, type HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HudWidgets } from "../ui/widgets/hud/index.js";

/** ?hud=1 shows the HUD-on state with fake data; ?hud=death also forces the death overlay. */
const HUD_QUERY_PARAM = "hud";

export interface HudSceneData {
  /** Pulled fresh every update() — DungeonScene's real snapshot builder. */
  source?: () => HudFakeSnapshot;
}

export class HudScene extends Phaser.Scene {
  private hud: HudWidgets | undefined;
  private snapshot: HudFakeSnapshot | undefined;
  private source: (() => HudFakeSnapshot) | undefined;

  constructor() {
    super("hud");
  }

  init(data?: HudSceneData): void {
    this.source = data?.source;
  }

  create(): void {
    const mode = new URLSearchParams(window.location.search).get(HUD_QUERY_PARAM);
    if (!this.source && mode !== "1" && mode !== "death") return;
    this.snapshot = mode === "death" ? fakeHudSnapshot(true) : mode === "1" ? fakeHudSnapshot(false) : undefined;
    this.hud = new HudWidgets(this, { width: this.scale.width, height: this.scale.height });
    const onResize = (gameSize: Phaser.Structs.Size) => this.handleResize(gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  update(time: number): void {
    if (!this.hud) return;
    const snapshot = this.source ? this.source() : this.snapshot;
    if (snapshot) this.hud.update(snapshot, time);
  }

  /** InputHud contract: forwarded to the live HudWidgets instance, if one is running. */
  hitTest(screenX: number, screenY: number): string | null {
    return this.hud?.hitTest(screenX, screenY) ?? null;
  }

  /** Toggles the chat panel — the touch layout's collapse-to-chip affordance (InputHooks.onToggleChat). */
  toggleChat(): void {
    this.hud?.toggleChat();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.hud?.resize({ width: gameSize.width, height: gameSize.height });
  }
}
