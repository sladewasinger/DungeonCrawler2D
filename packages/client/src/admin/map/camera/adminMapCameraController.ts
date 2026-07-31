import { LEVEL, type AdminPlayer, type LevelId } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import type { AdminSpectatorSurface } from "../../adminSpectatorSurface.js";
import type { AdminPageView } from "../../adminPageView.js";
import { boundedAdminFloor } from "../../adminPageSupport.js";
import { adminMapTileCenter, type AdminMapCenter } from "../adminMapCamera.js";
import {
  AdminMapRequestThrottle,
  type AdminMapRequest,
} from "./adminMapRequestThrottle.js";

const ADMIN_MAP_REFRESH_INTERVAL_MS = 400;

export interface AdminMapCameraControllerOptions {
  readonly connection: Connection;
  readonly view: AdminPageView;
  readonly surface: AdminSpectatorSurface;
}

/** Owns the inspector's free-pan and selected-player camera modes. */
export class AdminMapCameraController {
  private readonly mapRequests: AdminMapRequestThrottle;
  private followedPlayerId: string | null = null;
  private followedTile: AdminMapCenter | null = null;

  constructor(private readonly options: AdminMapCameraControllerOptions) {
    this.mapRequests = new AdminMapRequestThrottle({
      send: (request) => this.sendMapRequest(request),
      minimumIntervalMs: ADMIN_MAP_REFRESH_INTERVAL_MS,
    });
  }

  panTo(center: AdminMapCenter): void {
    if (!this.options.connection.adminAuthenticated) return;
    this.stopFollowing();
    this.requestMapAt(center);
  }

  inspectDefaultMap(): void {
    const center = { x: 0.5, y: 0.5 };
    this.options.view.mapLevel.value = "dungeon";
    this.options.view.mapFloor.value = "1";
    this.options.surface.focus(center);
    this.stopFollowing();
    this.requestMapAt(center);
  }

  inspectCurrentMap(): void {
    this.stopFollowing();
    this.requestMapAt(this.options.surface.center);
  }

  followPlayer(player: AdminPlayer | null): void {
    if (!player || !this.options.connection.adminAuthenticated) return;
    this.followedPlayerId = player.playerId;
    this.followedTile = null;
    this.followPlayerPosition(player);
  }

  freeCamera(): void {
    this.stopFollowing();
    this.options.surface.focusInput();
  }

  ensureViewportCoverage(): void {
    const map = this.options.connection.adminMap;
    if (map && map.radius >= this.options.surface.requiredMapRadius) return;
    this.requestMapAt(this.options.surface.center);
  }

  private stopFollowing(): void {
    this.followedPlayerId = null;
    this.followedTile = null;
  }

  refreshFollow(): void {
    if (!this.followedPlayerId) return;
    const player = this.options.connection.adminPlayers
      .find((candidate) => candidate.playerId === this.followedPlayerId) ?? null;
    if (player) return this.followPlayerPosition(player);
    this.stopFollowing();
  }

  dispose(): void {
    this.mapRequests.dispose();
  }

  private followPlayerPosition(player: AdminPlayer): void {
    const center = adminMapTileCenter(player);
    if (sameMapCenter(center, this.followedTile)) return;
    this.followedTile = center;
    this.options.view.mapLevel.value = player.level;
    this.options.view.mapFloor.value = String(player.floor);
    this.options.surface.focus(center);
    this.requestMapAt(center);
  }

  private requestMapAt(center: AdminMapCenter): void {
    if (!this.options.connection.adminAuthenticated) return;
    const map = this.options.connection.adminMap;
    this.mapRequests.request({
      level: mapLevel(this.options.view),
      floor: boundedAdminFloor(this.options.view.mapFloor.value, map?.floor ?? 1),
      center,
      radius: this.options.surface.requiredMapRadius,
    });
  }

  private sendMapRequest(request: AdminMapRequest): void {
    if (!this.options.connection.adminAuthenticated) return;
    this.options.connection.sendAdminCommand({
      op: "map",
      level: request.level,
      floor: request.floor,
      x: request.center.x,
      y: request.center.y,
      radius: request.radius,
    });
  }
}

function mapLevel(view: AdminPageView): LevelId {
  if (view.mapLevel.value === LEVEL.Sandbox) return LEVEL.Sandbox;
  if (view.mapLevel.value === LEVEL.CombatSandbox) return LEVEL.CombatSandbox;
  return LEVEL.Dungeon;
}

function sameMapCenter(left: AdminMapCenter, right: AdminMapCenter | null): boolean {
  return left.x === right?.x && left.y === right?.y;
}
