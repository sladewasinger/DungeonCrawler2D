import { Connection } from "../net/connection/connection.js";
import type { AdminAuthFailureReason } from "../net/connection/admin/adminMessages.js";
import { adminAuthenticationStatus } from "./auth/adminAuthenticationStatus.js";
import {
  clearAdminSessionKey,
  loadAdminSessionKey,
  saveAdminSessionKey,
} from "./adminSession.js";
import { AdminPageActionController } from "./commands/adminPageActionController.js";
import { AdminSpectatorSurface } from "./adminSpectatorSurface.js";
import { createAdminPageView, type AdminPageView } from "./adminPageView.js";
import { AdminSpawnPlacementController } from "./adminSpawnPlacementController.js";
import { setFreePanToggle } from "./map/adminMapFreePan.js";
import { AdminPlayerObserverController } from "./spectator/adminPlayerObserverController.js";

export interface AdminPageOptions {
  readonly root: HTMLElement;
  readonly url: string;
}

export class AdminPage {
  readonly connection: Connection;
  private readonly view: AdminPageView;
  private readonly surface: AdminSpectatorSurface;
  private readonly spawnPlacement: AdminSpawnPlacementController;
  private readonly playerObserver: AdminPlayerObserverController;
  private readonly actions: AdminPageActionController;

  constructor({ root, url }: AdminPageOptions) {
    this.connection = new Connection(url, "Admin", `admin-${crypto.randomUUID()}`);
    this.view = createAdminPageView(root);
    this.playerObserver = new AdminPlayerObserverController(this.connection, this.view);
    this.surface = new AdminSpectatorSurface({
      canvas: this.view.map,
      onCameraMove: (x, y) => this.spawnPlacement.requestMap(x, y),
      onSpawn: (x, y, selection) => this.spawnPlacement.spawn(x, y, selection),
      onDespawn: (entityId) => this.spawnPlacement.despawn(entityId),
      onZoomChange: (percent) => { this.view.mapZoomStatus.textContent = `Zoom: ${percent}%`; },
    });
    this.spawnPlacement = new AdminSpawnPlacementController({
      connection: this.connection,
      view: this.view,
      surface: this.surface,
      selectedPlayer: () => this.playerObserver.selectedPlayer(),
      onFreePanStateChange: (enabled) => setFreePanToggle(this.view.root, enabled),
    });
    this.actions = new AdminPageActionController({
      connection: this.connection,
      view: this.view,
      spawnPlacement: this.spawnPlacement,
      playerObserver: this.playerObserver,
    });
    this.connection.onConnected = () => this.resumeStoredSession();
    this.connection.onAdminAuth = (ok, reason) => this.renderAuth(ok, reason);
    this.connection.onAdminState = () => this.renderState();
    this.connection.onAdminObserverState = () => this.renderObserverState();
    this.connection.onAdminCommandResult = (result) => this.view.history.showCommandResult(result);
    this.view.login.addEventListener("click", () => this.authenticate());
    this.view.logout.addEventListener("click", () => this.logout());
    this.view.root.addEventListener("click", (event) => this.handleClick(event));
    this.view.root.addEventListener("keydown", (event) => this.handlePlayerKey(event));
  }

  start(): void {
    this.connection.connectAdmin();
    this.renderState();
  }

  stop(): void {
    this.spawnPlacement.dispose();
    this.surface.dispose();
    this.connection.disconnect();
  }

  private authenticate(): void {
    const token = this.view.token.value.trim();
    if (!token) {
      this.view.status.textContent = "Enter the server-provided admin token.";
      return;
    }
    this.view.status.textContent = "Authenticating…";
    this.connection.authenticateAdmin(token);
    this.view.token.value = "";
  }

  private resumeStoredSession(): void {
    const sessionKey = loadAdminSessionKey();
    if (!sessionKey) {
      this.view.status.textContent = "Enter the server-provided admin token.";
      return;
    }
    this.view.status.textContent = "Restoring authenticated admin session…";
    this.connection.resumeAdmin(sessionKey);
  }

  private logout(): void {
    if (!this.connection.adminAuthenticated) return;
    this.view.status.textContent = "Signing out…";
    this.connection.logoutAdmin();
  }

  private handleClick(event: Event): void {
    const control = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-admin-action]");
    const action = control?.dataset.adminAction;
    if (action) return this.actions.send(action, control);
    if (this.playerObserver.select(event.target)) {
      const player = this.playerObserver.selectedPlayer();
      this.spawnPlacement.followPlayer(player);
      if (player && this.connection.spectatorMode === "track") {
        this.connection.sendAdminCommand({ op: "spectate", playerId: player.playerId });
        return;
      }
      this.renderState();
    }
  }

  private handlePlayerKey(event: KeyboardEvent): void {
    if (!this.playerObserver.selectFromKey(event)) return;
    const player = this.playerObserver.selectedPlayer();
    this.spawnPlacement.followPlayer(player);
    if (player && this.connection.spectatorMode === "track") {
      this.connection.sendAdminCommand({ op: "spectate", playerId: player.playerId });
      return;
    }
    this.renderState();
  }

  private renderAuth(ok: boolean, reason?: AdminAuthFailureReason): void {
    if (ok && this.connection.adminSessionKey) {
      saveAdminSessionKey(this.connection.adminSessionKey);
    } else if (!ok) {
      clearAdminSessionKey();
      this.spawnPlacement.resetFreePan();
    }
    const status = {
      ok,
      capabilities: this.connection.adminCapabilities,
      ...(reason ? { reason } : {}),
    };
    this.view.authentication.render({
      authenticated: ok,
      status: adminAuthenticationStatus(status),
    });
    if (ok) this.spawnPlacement.inspectDefaultMap();
    this.renderState();
  }

  private renderState(): void {
    this.view.history.render(this.connection.adminHistory);
    this.playerObserver.render();
    this.spawnPlacement.render();
    this.surface.setInteractionEnabled(this.connection.adminAuthenticated);
    this.surface.setMap(this.connection.adminMap);
  }

  private renderObserverState(): void {
    this.playerObserver.render();
    this.spawnPlacement.render();
    this.spawnPlacement.refreshFollow();
  }
}
