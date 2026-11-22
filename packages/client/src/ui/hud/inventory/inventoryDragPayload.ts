/** Encodes and decodes structured drag-and-drop payloads across inventory slots. */
import type { ArmorSlot } from "@dc2d/engine";

export type InventoryDragSource = "backpack" | "hotbar" | "armor";

export interface InventoryDragPayload {
  readonly source: InventoryDragSource;
  readonly itemId: string;
  readonly fromSlot?: number;
  readonly armorSlot?: ArmorSlot;
}

const MIME_TYPE = "application/x-dc2d-inventory";

export function writeInventoryDragPayload(
  dataTransfer: DataTransfer | null,
  payload: InventoryDragPayload,
): void {
  if (!dataTransfer) return;
  dataTransfer.setData(MIME_TYPE, JSON.stringify(payload));
  dataTransfer.setData("text/plain", payload.itemId);
}

export function readInventoryDragPayload(
  dataTransfer: DataTransfer | null,
): InventoryDragPayload | null {
  if (!dataTransfer) return null;
  const parsed = parseStructuredPayload(dataTransfer.getData(MIME_TYPE));
  if (parsed) return parsed;
  const fallbackId = dataTransfer.getData("text/plain")?.trim();
  return fallbackId ? { source: "backpack", itemId: fallbackId } : null;
}

function parseStructuredPayload(raw: string): InventoryDragPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InventoryDragPayload>;
    return parsed.itemId && parsed.source ? (parsed as InventoryDragPayload) : null;
  } catch {
    return null;
  }
}
