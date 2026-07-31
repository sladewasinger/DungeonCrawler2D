import type { Connection } from "../net/connection/connection.js";
import { SharedHtmlHud } from "../ui/hud/core/SharedHtmlHud.js";

export class SpectatorHud {
  private readonly hud: SharedHtmlHud;

  constructor(
    root: HTMLElement,
    private readonly connection: Connection,
  ) {
    this.hud = new SharedHtmlHud({
      root,
      connection,
      focusGame: () => {},
      bindKeyboard: false,
      showReticle: false,
      showHealthFeedback: false,
      session: { respawn: () => {}, rescue: () => {}, quitToTitle: () => {} },
    });
    this.hud.element.dataset.spectatorHud = "";
    this.hud.element.style.pointerEvents = "none";
    this.hud.element.inert = true;
    this.hud.adminDebug.element.hidden = true;
  }

  setVisible(visible: boolean): void {
    this.hud.element.hidden = !visible;
  }

  update(fps: number): void {
    const { body, world } = this.connection;
    if (!body || !world) return;
    this.hud.update({
      connection: this.connection,
      world,
      player: {
        x: body.x,
        y: body.z,
        z: body.y,
        verticalVelocity: body.zVel,
        grounded: body.grounded,
      },
      yaw: 0,
      mouseCaptured: false,
      fps,
    });
  }

  dispose(): void {
    this.hud.dispose();
  }
}
