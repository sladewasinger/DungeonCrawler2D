import type { AdminPalette } from "@dc2d/engine";
import type { AdminPageView } from "./adminPageView.js";

export type AdminSpawnKind = "enemy" | "item" | "weapon";

export function adminSpawnKind(value: string): AdminSpawnKind {
  return value === "item" || value === "weapon" ? value : "enemy";
}

export function paletteDefinitions(
  palette: AdminPalette,
  kind: AdminSpawnKind,
): readonly string[] {
  if (kind === "enemy") return palette.enemies;
  return kind === "item" ? palette.items : palette.weapons;
}

export function boundedAdminFloor(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 64 ? parsed : fallback;
}

export function adminOption(value: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = value;
  return element;
}

export function renderAdminCommandResult(
  view: AdminPageView,
  result: { readonly ok: boolean; readonly code?: string; readonly message?: string },
): void {
  if (result.ok && !result.message && !result.code) return;
  const detail = result.message ?? result.code ?? "complete";
  view.status.textContent = result.ok ? `Admin command: ${detail}` : `Admin command rejected: ${detail}`;
}
