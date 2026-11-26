/** LocalStorage persistence for custom character name and paper-doll appearance. */
import { DEFAULT_APPEARANCE, sanitizeCharacterAppearance, type CharacterAppearance } from "@dc2d/engine";
import { z } from "zod";

const StoredCharacterSchema = z.object({
  name: z.string().max(40).optional(),
  appearance: z.unknown().optional(),
});

const StoredAuthTokenSchema = z.object({
  accountId: z.string().min(4).max(64),
  resumeToken: z.string().min(16).max(256),
});

const STORAGE_KEY = "dc2d.character.v1";

export interface CharacterPrefs {
  readonly name: string;
  readonly appearance: CharacterAppearance;
}

export function sanitizeCharacterName(raw: string | undefined): string {
  const clean = (raw ?? "").trim().slice(0, 20);
  return clean.length > 0 ? clean : "Adventurer";
}

export function loadCharacterPrefs(): CharacterPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 2048) return { name: "Adventurer", appearance: { ...DEFAULT_APPEARANCE } };
    const res = StoredCharacterSchema.safeParse(JSON.parse(raw));
    if (!res.success) return { name: "Adventurer", appearance: { ...DEFAULT_APPEARANCE } };
    const name = sanitizeCharacterName(res.data.name);
    return { name, appearance: sanitizeCharacterAppearance(res.data.appearance) };
  } catch {
    return { name: "Adventurer", appearance: { ...DEFAULT_APPEARANCE } };
  }
}

export function saveCharacterPrefs(prefs: CharacterPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: sanitizeCharacterName(prefs.name),
      appearance: sanitizeCharacterAppearance(prefs.appearance),
    }));
  } catch {
    // Ignore storage quota or private-mode restrictions.
  }
}

const AUTH_STORAGE_KEY = "dc2d:auth-token:v1";

export interface StoredAuthToken {
  readonly accountId: string;
  readonly resumeToken: string;
}

export function readStoredAuthToken(): StoredAuthToken | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw || raw.length > 512) return null;
    const res = StoredAuthTokenSchema.safeParse(JSON.parse(raw));
    return res.success ? res.data : null;
  } catch { return null; }
}

export function writeStoredAuthToken(token: StoredAuthToken): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(token));
  } catch { /* ignore storage quota errors */ }
}
