import type { World } from "@dc2d/engine";
import type { Connection } from "../../net/connection/connection.js";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import type { RenderPose } from "../../scenes/dungeon/orchestration/state.js";
import {
  SpectatorCamera,
  type SpectatorCameraPoint,
} from "./spectatorCamera.js";

interface SpectatorCameraTrackingInput {
  readonly connection: Connection;
  readonly render: RenderPose;
  readonly deltaMs: number;
  readonly teleported: boolean;
}

export class SpectatorCameraTracking {
  private readonly camera: SpectatorCamera;
  private targetId: string | null = null;
  private world: World | null = null;
  private initialized = false;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new SpectatorCamera(canvas);
  }

  update(input: SpectatorCameraTrackingInput): SpectatorCameraPoint {
    const target = worldToScreen(input.render.x, input.render.y);
    const free = input.connection.spectatorMode === "free";
    const identityChanged = this.captureIdentity(input.connection);
    if (spectatorCameraResetRequired({
      free,
      teleported: input.teleported,
      identityChanged,
    })) this.camera.reset(target);
    return this.camera.update(target, input.deltaMs, free);
  }

  focus(): void { this.camera.focus(); }
  centerOnTarget(): void { this.camera.centerOnTarget(); }
  dispose(): void { this.camera.dispose(); }

  private captureIdentity(connection: Connection): boolean {
    const changed = !this.initialized || this.targetId !== connection.spectatorTargetId ||
      this.world !== connection.world;
    this.targetId = connection.spectatorTargetId;
    this.world = connection.world;
    this.initialized = true;
    return changed;
  }
}

export function spectatorCameraResetRequired(input: {
  readonly free: boolean;
  readonly teleported: boolean;
  readonly identityChanged: boolean;
}): boolean {
  return input.identityChanged || (input.teleported && !input.free);
}
