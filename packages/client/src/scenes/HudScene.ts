import Phaser from "phaser";
import { BossBarWidget } from "../ui/widgets/hud/bars/bossBar.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/core/fakeData.js";
import { HudWidgets } from "../ui/widgets/hud/core/index.js";
import type { Connection } from "../net/connection/connection.js";
import { HtmlTouchHitRegions } from "../ui/hud/touch/HtmlTouchHitRegions.js";
import { SharedHtmlHud } from "../ui/hud/core/SharedHtmlHud.js";
import { createHtmlHudLifecycle, type HtmlHudLifecycle } from "./hudHtmlLifecycle.js";
import { applyHudPreviewAids, resolveHudPreview } from "./hudPreview.js";
import type { HudSceneData } from "./hudSceneData.js";
import { TeleportFade } from "../vfx/overlays/teleport/teleportFade.js";
export type { HudSceneData } from "./hudSceneData.js";

export class HudScene extends Phaser.Scene {
  private hud: HudWidgets | undefined;
  private bossBar: BossBarWidget | undefined;
  private snapshot: HudFakeSnapshot | undefined;
  private source: (() => HudFakeSnapshot) | undefined;
  private actions: HudSceneData["actions"];
  private social: HudSceneData["social"];
  private stations: HudSceneData["stations"];
  private connection: Connection | undefined;
  private htmlHud: SharedHtmlHud | undefined; private htmlHudLifecycle: HtmlHudLifecycle | undefined;
  private readonly touchHits = new HtmlTouchHitRegions();
  private onSelectHotbar: ((index: number | null) => void) | undefined;
  private session: HudSceneData["session"];
  private teleportFade: TeleportFade | undefined;

  constructor() {
    super("hud");
  }

  init(data?: HudSceneData): void {
    this.source = data?.source;
    this.actions = data?.actions;
    this.social = data?.social;
    this.stations = data?.stations;
    this.connection = data?.connection;
    this.onSelectHotbar = data?.onSelectHotbar;
    this.session = data?.session;
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.snapshot = this.source ? undefined : resolveHudPreview(params) ?? undefined;
    if (!this.source && !this.snapshot) return;
    this.createHudSurface();
    this.createTeleportFade();
    applyHudPreviewAids(params, this.snapshot, this.hud);
    const onResize = (gameSize: Phaser.Structs.Size) => this.handleResize(gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private createHudSurface(): void {
    if (this.source && this.connection) this.createHtmlHud(this.connection);
    else this.createPreviewHud();
  }

  private createTeleportFade(): void {
    this.teleportFade = new TeleportFade(this);
    const unbind = TeleportFade.bind(this, this.teleportFade);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbind();
      this.teleportFade?.dispose();
      this.teleportFade = undefined;
    });
  }

  update(time: number): void {
    this.teleportFade?.update(time);
    const snapshot = this.source ? this.source() : this.snapshot;
    if (!snapshot) return;
    if (this.htmlHud) {
      this.updateHtmlHud(snapshot);
      return;
    }
    this.hud?.update(snapshot, time);
    this.bossBar?.update(snapshot.boss);
  }

  hitTest(screenX: number, screenY: number): string | null {
    if (!this.htmlHud) return this.hud?.hitTest(screenX, screenY) ?? null;
    return this.touchHits.hitTest({ x: screenX, y: screenY, width: this.scale.width, height: this.scale.height });
  }

  toggleChat(): void { if (this.htmlHud) this.htmlHud.toggleChat(); else this.hud?.toggleChat(); }

  toggleInventory(): void { if (this.htmlHud) this.htmlHud.toggleInventory(); else this.hud?.toggleInventory(); }

  inventoryOpen(): boolean { return this.htmlHud?.inventoryOpen() ?? this.hud?.inventoryOpen() ?? false; }

  blocksGameplay(): boolean { return this.htmlHud?.blocksGameplay() ?? this.hud?.inventoryOpen() ?? false; }

  sessionMenuOpen(): boolean { return this.htmlHud?.sessionMenuOpen() ?? false; }

  toggleSessionMenu(): void { this.htmlHud?.toggleSessionMenu(); }

  selectedInventoryItem(): string | null { return this.htmlHud ? null : this.hud?.selectedInventoryItem() ?? null; }

  closeInventory(): void { if (this.htmlHud) this.htmlHud.closeInventory(); else this.hud?.closeInventory(); }

  focusChat(): void { this.htmlHud?.focusChat(); }

  toggleContacts(): void { if (this.htmlHud) this.htmlHud.toggleContacts(); else this.hud?.toggleContacts(); }

  closeContacts(): void { if (this.htmlHud) this.htmlHud.closeContacts(); else this.hud?.closeContacts(); }

  closeTransientOverlays(): boolean { return this.htmlHud?.closeOverlays() ?? false; }

  craftOpen(): boolean { return this.htmlHud?.craftOpen() ?? this.hud?.craftOpen() ?? false; }

  toggleCraftPanel(): void { if (this.htmlHud) this.htmlHud.toggleCraft(); else this.hud?.toggleCraftPanel(); }

  closeCraftPanel(): void { if (this.htmlHud) this.htmlHud.closeCraft(); else this.hud?.closeCraftPanel(); }

  stashOpen(): boolean { return this.htmlHud?.stashOpen() ?? this.hud?.stashOpen() ?? false; }

  openStashPanel(): void { if (this.htmlHud) this.htmlHud.openStash(); else this.hud?.openStashPanel(); }

  closeStashPanel(): void { if (this.htmlHud) this.htmlHud.closeStash(); else this.hud?.closeStashPanel(); }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.teleportFade?.resize(gameSize.width, gameSize.height);
    const viewport = { width: gameSize.width, height: gameSize.height };
    this.hud?.resize(viewport);
    if (this.hud) this.bossBar?.resize(this.hud.registry, viewport);
  }

  private createHtmlHud(connection: Connection): void {
    this.htmlHudLifecycle = createHtmlHudLifecycle({
      connection,
      canvas: this.game.canvas,
      keyboard: this.input.keyboard ?? undefined,
      ...(this.onSelectHotbar ? { onSelectHotbar: this.onSelectHotbar } : {}),
      ...(this.session ? { session: this.session } : {}),
    });
    this.htmlHud = this.htmlHudLifecycle.hud;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.htmlHudLifecycle?.dispose();
      this.htmlHudLifecycle = undefined;
      this.htmlHud = undefined;
    });
  }

  private updateHtmlHud(snapshot: HudFakeSnapshot): void {
    if (!this.htmlHudLifecycle || !this.connection) return;
    this.touchHits.setActive(snapshot.touch !== null);
    this.htmlHudLifecycle.update(snapshot);
  }

  private createPreviewHud(): void {
    const viewport = { width: this.scale.width, height: this.scale.height };
    this.hud = new HudWidgets({
      scene: this,
      viewport,
      ...(this.actions ? { actions: this.actions } : {}),
      ...(this.social ? { social: this.social } : {}),
      ...(this.stations ? { stations: this.stations } : {}),
      ...(this.connection ? { onRespawnNow: () => this.connection?.suicide() } : {}),
    });
    this.bossBar = new BossBarWidget(this, this.hud.registry, viewport);
  }
}
