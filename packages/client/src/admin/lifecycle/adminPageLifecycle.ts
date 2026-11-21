import { Connection } from "../../net/connection/connection.js";
import type { AdminMap } from "@dc2d/engine";
import type { AdminAuthFailureReason } from "../../net/connection/admin/adminMessages.js";
import { adminAuthenticationStatus } from "../auth/adminAuthenticationStatus.js";
import {
  clearAdminSessionKey,
  saveAdminSessionKey,
} from "../portal/adminSession.js";
import type { AdminPageView } from "../portal/adminPageView.js";
import { AdminSpectatorSurface } from "../adminSpectatorSurface.js";
import { AdminSpawnPlacementController } from "../adminSpawnPlacementController.js";
import { AdminPlayerObserverController } from "../spectator/adminPlayerObserverController.js";

interface AdminPageRenderContext {
  readonly connection: Connection;
  readonly view: AdminPageView;
  readonly surface: AdminSpectatorSurface;
  readonly spawnPlacement: AdminSpawnPlacementController;
  readonly playerObserver: AdminPlayerObserverController;
}

export interface AdminPageLifecycle {
  renderAuth(ok: boolean, reason?: AdminAuthFailureReason): void;
  renderState(): void;
  renderObserverState(): void;
}

export function createAdminPageLifecycle(
  context: AdminPageRenderContext,
): AdminPageLifecycle {
  return {
    renderAuth: (ok, reason) => renderAuth(context, ok, reason),
    renderState: () => renderState(context),
    renderObserverState: () => renderObserverState(context),
  };
}

function renderAuth(
  context: AdminPageRenderContext,
  ok: boolean,
  reason?: AdminAuthFailureReason,
): void {
  const { connection, view, spawnPlacement } = context;
  if (ok && connection.adminSessionKey) saveAdminSessionKey(connection.adminSessionKey);
  if (!ok) {
    clearAdminSessionKey();
    spawnPlacement.resetFreePan();
  }
  const status = {
    ok,
    capabilities: connection.adminCapabilities,
    ...(reason ? { reason } : {}),
  };
  view.authentication.render({ authenticated: ok, status: adminAuthenticationStatus(status) });
  if (ok) spawnPlacement.inspectDefaultMap();
  renderState(context);
}

function renderState(context: AdminPageRenderContext): void {
  const { connection, view, surface, spawnPlacement, playerObserver } = context;
  view.history.render(connection.adminHistory);
  playerObserver.render();
  spawnPlacement.render();
  surface.setInteractionEnabled(connection.adminAuthenticated);
  surface.setMap(mapForAdminSurface(connection));
}

function renderObserverState(context: AdminPageRenderContext): void {
  const { connection, surface, spawnPlacement, playerObserver } = context;
  playerObserver.render();
  spawnPlacement.render();
  surface.setMap(mapForAdminSurface(connection));
  spawnPlacement.refreshFollow();
}

export function mapForAdminSurface(connection: Pick<Connection,
  "adminMap" | "adminSpectatorMap" | "spectatorMode">): AdminMap | null {
  return connection.spectatorMode === "off"
    ? connection.adminMap
    : connection.adminSpectatorMap ?? connection.adminMap;
}
