/**
 * Pure detector for the fistbump-sealed system line (Epic 7.10): the server sends
 * no dedicated "contact sealed" wire event (only a system chat line + contactsUpdated,
 * see sim/contacts.ts's sealMutualContact), so the client recognizes the exact,
 * server-authored phrasing to trigger the local success flourish. Pure string match —
 * no network, no DOM — so it's unit-tested without a live Connection.
 */

const SEAL_PATTERN = /^You and (.+) are now contacts!$/;

/** Returns the partner's display name if `text` is the mutual-contact seal line, else null. */
export function parseFistbumpSealPartner(channel: string, text: string): string | null {
  if (channel !== "system") return null;
  const match = SEAL_PATTERN.exec(text);
  return match ? match[1]! : null;
}
