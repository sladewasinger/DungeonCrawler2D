/** Renders live build, connection, seed, position, and heading telemetry. */
import { biomeAtWorldTile, displayCoordinates, type World } from "@dc2d/engine";
import { BUILD_SHA } from "../../../buildInfo.js";
import { APP_VERSION } from "../../../appVersion.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { FirstPersonState } from "../../../three/input/movement.js";
import { HUD_PANEL, createHudTitle } from "../styles/HudStyles.js";
import { biomeLabel } from "../../../worldStatus.js";

export const headingDegrees = (yaw: number): number => Math.round(
  ((((-yaw * 180) / Math.PI) % 360) + 360) % 360,
);

export class HudTelemetry {
  readonly element = document.createElement("div");
  private readonly readout = document.createElement("div");

  constructor() {
    this.element.style.cssText = HUD_PANEL;
    this.readout.style.whiteSpace = "pre-wrap";
    this.element.append(createHudTitle("World status"), this.readout);
  }

  update({ connection, world, player, yaw, mouseCaptured }: HudTelemetryUpdate): void {
    const heading = headingDegrees(yaw);
    const display = displayCoordinates(player.x, player.z);
    const biome = biomeAtWorldTile({ worldSeed: world.worldSeed, floor: world.floor, wx: player.x, wy: player.z }).biome;
    this.readout.textContent =
      `version ${APP_VERSION}\n` +
      `build ${BUILD_SHA}\n` +
      `floor ${world.floor} · ${connection.status}\n` +
      `seed ${world.worldSeed}\n` +
      `biome ${biomeLabel(biome)}\n` +
      `x ${display.x.toFixed(1)}, y ${display.y.toFixed(1)}, z ${player.y.toFixed(2)}\n` +
      `heading ${heading}°\n` +
      (mouseCaptured
        ? "mouse captured"
        : "click the world to capture mouse");
  }
}

export interface HudTelemetryUpdate {
  readonly connection: Connection;
  readonly world: World;
  readonly player: FirstPersonState;
  readonly yaw: number;
  readonly mouseCaptured: boolean;
}
