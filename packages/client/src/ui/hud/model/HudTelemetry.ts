/** Renders live performance, build, connection, seed, position, and heading telemetry. */
import { displayCoordinates, type World } from "@dc2d/engine";
import { BUILD_SHA } from "../../../buildInfo.js";
import { APP_VERSION } from "../../../appVersion.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { FirstPersonState } from "../../../three/input/movement.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";
import { biomeLabel } from "../../../worldStatus.js";

export const headingDegrees = (yaw: number): number => Math.round(
  ((((-yaw * 180) / Math.PI) % 360) + 360) % 360,
);

export interface TelemetryPerformanceInput {
  readonly connected: boolean;
  readonly fps: number | undefined;
  readonly latencyMs: number;
}

export const telemetryPerformanceLine = ({ connected, fps, latencyMs }: TelemetryPerformanceInput): string => {
  const fpsText = fps === undefined ? "—" : String(Math.round(fps));
  const latencyText = connected ? `${Math.round(latencyMs)}ms` : "offline";
  return `fps ${fpsText} · latency ${latencyText}`;
};

export class HudTelemetry {
  readonly element: HTMLElement;
  private readonly readout: HTMLElement;

  constructor() {
    this.element = createHudTemplate<HTMLElement>("hud-telemetry-template");
    this.readout = requireHudElement(this.element, "[data-hud-telemetry-readout]");
  }

  update({ connection, world, player, yaw, mouseCaptured, fps, latencyMs }: HudTelemetryUpdate): void {
    const heading = headingDegrees(yaw);
    const display = displayCoordinates(player.x, player.z);
    const biome = world.biomeAtWorldTile(player.x, player.z)?.biome ?? "maze";
    const seedInputText = connection.welcome?.seedInputText ?? "—";
    this.readout.textContent =
      `${telemetryPerformanceLine({ connected: connection.status === "connected", fps, latencyMs })}\n` +
      `version ${APP_VERSION}\n` +
      `build ${BUILD_SHA}\n` +
      `floor ${world.floor} · ${connection.status}\n` +
      `seed ${seedInputText}\n` +
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
  readonly fps: number | undefined;
  readonly latencyMs: number;
}
