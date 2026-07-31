import type { AdminPlayer } from "@dc2d/engine";
import { cell } from "../adminPagePrimitives.js";

export function renderAdminPlayers(
  input: AdminPlayerTableInput,
): void {
  playerTable(input.playersElement).render(input);
}

export interface AdminPlayerTableInput {
  readonly playersElement: HTMLTableSectionElement;
  readonly players: readonly AdminPlayer[];
  readonly authenticated: boolean;
  readonly selectedPlayerId: string | null;
}

interface PlayerRowInput {
  readonly player: AdminPlayer;
  readonly authenticated: boolean;
  readonly selectedPlayerId: string | null;
}

interface PlayerRow {
  readonly element: HTMLTableRowElement;
  readonly identity: HTMLTableCellElement;
  readonly location: HTMLTableCellElement;
  readonly status: HTMLTableCellElement;
}

class AdminPlayerTable {
  private readonly rows = new Map<string, PlayerRow>();

  constructor(private readonly element: HTMLTableSectionElement) {}

  render(input: AdminPlayerTableInput): void {
    const playerIds = input.players.map((player) => player.playerId);
    this.removeDisconnectedRows(playerIds);
    for (const player of input.players) {
      const row = this.rows.get(player.playerId) ?? this.createRow(player.playerId);
      updatePlayerRow(row, {
        player,
        authenticated: input.authenticated,
        selectedPlayerId: input.selectedPlayerId,
      });
    }
    this.reorderOnlyWhenNeeded(playerIds);
  }

  private createRow(playerId: string): PlayerRow {
    const row = playerRow(playerId);
    this.rows.set(playerId, row);
    return row;
  }

  private removeDisconnectedRows(playerIds: readonly string[]): void {
    const connected = new Set(playerIds);
    for (const [playerId, row] of this.rows) {
      if (connected.has(playerId)) continue;
      row.element.remove();
      this.rows.delete(playerId);
    }
  }

  private reorderOnlyWhenNeeded(playerIds: readonly string[]): void {
    if (samePlayerOrder(this.element, playerIds)) return;
    for (const [index, playerId] of playerIds.entries()) {
      const row = this.rows.get(playerId)!.element;
      if (this.element.children[index] === row) continue;
      this.element.insertBefore(row, this.element.children[index] ?? null);
    }
  }
}

const PLAYER_TABLES = new WeakMap<HTMLTableSectionElement, AdminPlayerTable>();

function playerTable(element: HTMLTableSectionElement): AdminPlayerTable {
  let table = PLAYER_TABLES.get(element);
  if (!table) {
    table = new AdminPlayerTable(element);
    PLAYER_TABLES.set(element, table);
  }
  return table;
}

function playerRow(playerId: string): PlayerRow {
  const row = document.createElement("tr");
  const identity = cell("");
  const location = cell("");
  const status = cell("");
  row.dataset.adminPlayerSelect = "";
  row.dataset.playerId = playerId;
  row.append(identity, location, status);
  return { element: row, identity, location, status };
}

function updatePlayerRow(row: PlayerRow, input: PlayerRowInput): void {
  const selected = input.player.playerId === input.selectedPlayerId;
  updateText(row.identity, playerIdentity(input.player));
  updateText(row.location, positionText(input.player));
  updateText(row.status, statusText(input.player));
  updateRowSelection(row.element, selected, input.authenticated);
}

function updateText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function updateRowSelection(
  row: HTMLTableRowElement,
  selected: boolean,
  authenticated: boolean,
): void {
  const selectedValue = String(selected);
  const tabIndex = authenticated ? 0 : -1;
  if (row.dataset.selected !== selectedValue) row.dataset.selected = selectedValue;
  if (row.tabIndex !== tabIndex) row.tabIndex = tabIndex;
  if (row.getAttribute("aria-selected") !== selectedValue) {
    row.setAttribute("aria-selected", selectedValue);
  }
}

function samePlayerOrder(
  element: HTMLTableSectionElement,
  playerIds: readonly string[],
): boolean {
  if (element.children.length !== playerIds.length) return false;
  return playerIds.every(
    (playerId, index) => element.children[index]?.getAttribute("data-player-id") === playerId,
  );
}

function playerIdentity(player: AdminPlayer): string {
  const device = [player.platform, pointerType(player.touch)]
    .filter(Boolean)
    .join(" · ");
  return [
    `${player.name} · ${player.playerId}`,
    device || undefined,
    player.userAgent,
  ].filter(Boolean).join("\n");
}

function pointerType(touch: boolean | undefined): string | undefined {
  if (touch === undefined) return undefined;
  return touch ? "touch" : "pointer";
}

function positionText(player: AdminPlayer): string {
  return `${player.level} / floor ${player.floor} · ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, z${player.z.toFixed(1)}`;
}

function statusText(player: AdminPlayer): string {
  const flags = [
    player.downed ? "downed" : "alive",
    player.god ? "god" : "",
    player.handicapped ? "handicap" : "",
  ];
  const statuses = player.statuses.length ? ` · ${player.statuses.join(", ")}` : "";
  return `${flags.filter(Boolean).join(" · ")} · ${player.hp}/${player.maxHp} hp${statuses}`;
}
