import type { GameEvent } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";

export function applyContactsEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "contactsUpdated") return false;
  conn.contacts = event.contacts.map(contactInfo);
  return true;
}

function contactInfo(contact: { readonly id?: string | undefined; readonly name: string; readonly online: boolean }) {
  return { name: contact.name, online: contact.online, ...(contact.id === undefined ? {} : { id: contact.id }) };
}

export function applyModerationEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "moderationUpdated") return false;
  conn.mutedPlayers = new Set(event.muted);
  conn.blockedPlayers = new Set(event.blocked);
  return true;
}
