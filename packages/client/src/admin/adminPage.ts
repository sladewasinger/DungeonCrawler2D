import { Connection } from "../net/connection/connection.js";
import {
  clearAdminSessionKey,
  loadAdminSessionKey,
  saveAdminSessionKey,
} from "./adminSession.js";
import { commandForAdminAction } from "./commands/adminCommandFactory.js";
import { AdminSpectatorSurface } from "./adminSpectatorSurface.js";
import { createAdminPageView, type AdminPageView } from "./adminPageView.js";
import { renderAdminCommandResult } from "./adminPageSupport.js";
import { AdminSpawnPlacementController } from "./adminSpawnPlacementController.js";
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

  constructor({ root, url }: AdminPageOptions) {
    this.connection = new Connection(url, "Admin", `admin-${crypto.randomUUID()}`);
    this.view = createAdminPageView(root);
    this.playerObserver = new AdminPlayerObserverController(this.connection, this.view);
    this.surface = new AdminSpectatorSurface({
      canvas: this.view.map,
      onCameraMove: (x, y) => this.spawnPlacement.requestMap(x, y),
      onSpawn: (x, y, selection) => this.spawnPlacement.spawn(x, y, selection),
      onDespawn: (entityId) => this.spawnPlacement.despawn(entityId),
    });
    this.spawnPlacement = new AdminSpawnPlacementController({
      connection: this.connection,
      view: this.view,
      surface: this.surface,
    });
    this.connection.onConnected = () => this.resumeStoredSession();
    this.connection.onAdminAuth = (ok) => this.renderAuth(ok);
    this.connection.onAdminState = () => this.renderState();
    this.connection.onAdminObserverState = () => this.playerObserver.render();
    this.connection.onAdminCommandResult = (result) => renderAdminCommandResult(this.view, result);
    this.view.login.addEventListener("click", () => this.authenticate());
    this.view.root.addEventListener("click", (event) => this.handleClick(event));
    this.view.root.addEventListener("keydown", (event) => this.handlePlayerKey(event));
  }

  start(): void {
    this.connection.connectAdmin();
    this.renderState();
  }

  stop(): void {
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

  private handleClick(event: Event): void {
    const control = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-admin-action]");
    const action = control?.dataset.adminAction;
    if (action) return this.sendAction(action, control.dataset.playerId);
    if (this.playerObserver.select(event.target)) this.renderState();
  }

  private handlePlayerKey(event: KeyboardEvent): void {
    if (this.playerObserver.selectFromKey(event)) this.renderState();
  }

  private sendAction(action: string, playerId?: string): void {
    if (action === "inspect-map") {
      this.spawnPlacement.inspectCurrentMap();
      return;
    }
    const command = commandForAdminAction(action, playerId);
    if (command) this.connection.sendAdminCommand(command);
  }

  private renderAuth(ok: boolean): void {
    if (ok && this.connection.adminSessionKey) {
      saveAdminSessionKey(this.connection.adminSessionKey);
    } else if (!ok) {
      clearAdminSessionKey();
    }
    this.view.status.textContent = ok
      ? `Authenticated · ${this.connection.adminCapabilities.join(", ") || "no capabilities"}`
      : "Authentication failed.";
    this.renderState();
  }

  private renderState(): void {
    this.playerObserver.render();
    this.spawnPlacement.render();
    this.surface.setInteractionEnabled(this.connection.adminAuthenticated);
    this.surface.setMap(this.connection.adminMap);
  }
}
