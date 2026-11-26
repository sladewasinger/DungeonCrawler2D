/** LocalStorage persistence for custom character name and paper-doll appearance. */
import { DEFAULT_APPEARANCE, sanitizeCharacterAppearance, type CharacterAppearance } from "@dc2d/engine";

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
    if (!raw) return { name: "Adventurer", appearance: { ...DEFAULT_APPEARANCE } };
    const parsed = JSON.parse(raw) as { name?: unknown; appearance?: unknown };
    const name = typeof parsed.name === "string" ? sanitizeCharacterName(parsed.name) : "Adventurer";
    return { name, appearance: sanitizeCharacterAppearance(parsed.appearance) };
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
    const parsed = JSON.parse(raw) as Partial<StoredAuthToken>;
    return typeof parsed.accountId === "string" && typeof parsed.resumeToken === "string"
      ? { accountId: parsed.accountId, resumeToken: parsed.resumeToken } : null;
  } catch { return null; }
}

export function writeStoredAuthToken(token: StoredAuthToken): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(token));
  } catch { /* ignore storage quota errors */ }
}
