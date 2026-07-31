import { button, text, title } from "./adminPagePrimitives.js";
import { mapPanel } from "./adminMapPanel.js";
import type { AdminSpawnCatalog } from "./catalog/adminSpawnCatalog.js";
import {
  createAdminPlayerObserver,
  type AdminPlayerObserver,
} from "./spectator/adminPlayerObserver.js";
export { renderAdminPlayers } from "./players/adminPlayerTable.js";

export interface AdminPageView {
  readonly root: HTMLElement;
  readonly status: HTMLElement;
  readonly token: HTMLInputElement;
  readonly login: HTMLButtonElement;
  readonly players: HTMLTableSectionElement;
  readonly map: HTMLCanvasElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
  readonly spawnKind: HTMLSelectElement;
  readonly spawnDef: HTMLSelectElement;
  readonly catalog: AdminSpawnCatalog;
  readonly playerObserver: AdminPlayerObserver;
}

export function createAdminPageView(root: HTMLElement): AdminPageView {
  root.replaceChildren();
  root.style.cssText = "margin:0;min-height:100vh;background:#11131a;color:#e9edf5;font:14px system-ui,sans-serif";
  const page = document.createElement("main");
  page.style.cssText = "max-width:1280px;margin:auto;padding:24px;display:grid;gap:16px";
  const spawnMap = mapPanel();
  const playerObserver = createAdminPlayerObserver();
  page.append(header(), authPanel(), playersPanel(), playerObserver.root, spawnMap.root);
  root.append(page);
  return {
    root,
    status: page.querySelector<HTMLElement>("[data-admin-status]")!,
    token: page.querySelector<HTMLInputElement>("[data-admin-token]")!,
    login: page.querySelector<HTMLButtonElement>("[data-admin-login]")!,
    players: page.querySelector<HTMLTableSectionElement>("[data-admin-players]")!,
    map: spawnMap.map,
    mapLevel: spawnMap.mapLevel,
    mapFloor: spawnMap.mapFloor,
    spawnKind: spawnMap.spawnKind,
    spawnDef: spawnMap.spawnDef,
    catalog: spawnMap.catalog,
    playerObserver,
  };
}

function header(): HTMLElement {
  const section = document.createElement("section");
  section.append(title("Dungeon admin"), text("Authenticated control surface · tokens never enter the URL"));
  return section;
}

function authPanel(): HTMLElement {
  const section = panel("Authentication");
  const token = document.createElement("input");
  token.type = "password";
  token.placeholder = "ADMIN_TOKEN";
  token.autocomplete = "current-password";
  token.dataset.adminToken = "";
  const login = button("Authenticate", "admin-login");
  login.dataset.adminLogin = "";
  const status = text("Not authenticated");
  status.dataset.adminStatus = "";
  section.append(token, login, status);
  return section;
}

function playersPanel(): HTMLElement {
  const section = panel("Connected players");
  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse";
  table.append(tableHead(), document.createElement("tbody"));
  table.tBodies[0]!.dataset.adminPlayers = "";
  section.append(table);
  return section;
}

function tableHead(): HTMLTableSectionElement {
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  for (const label of ["Player", "Location", "Status"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    cell.style.cssText = "padding:8px;text-align:left;border-bottom:1px solid #394152";
    row.append(cell);
  }
  head.append(row);
  return head;
}

function panel(label: string): HTMLElement {
  const section = document.createElement("section");
  section.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px;background:#1b1f2a;border:1px solid #394152;border-radius:6px";
  section.append(title(label));
  return section;
}
