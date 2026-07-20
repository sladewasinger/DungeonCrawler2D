/** Browser-persisted identity: stable client id + session resume token. */

const RESUME_KEY = "dc2d-resume-token";
const CLIENT_ID_KEY = "dc2d-client-id";

/**
 * crypto.randomUUID exists only in SECURE contexts (https / localhost) — a phone
 * loading the dev box over plain http://192.168.x.x has crypto but not randomUUID.
 * getRandomValues works everywhere, so hand-roll a v4 UUID from it as the fallback.
 */
function generateClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function persistentClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = generateClientId();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function loadResumeToken(level?: string): string | undefined {
  return (
    sessionStorage.getItem(level ? `${RESUME_KEY}:${level}` : RESUME_KEY) ??
    sessionStorage.getItem(RESUME_KEY) ??
    undefined
  );
}

export function saveResumeToken(token: string, level: string): void {
  sessionStorage.setItem(`${RESUME_KEY}:${level}`, token);
  sessionStorage.removeItem(RESUME_KEY);
}

/** Purges a dead session's resume token so title's auto-resume doesn't loop back into
 * the same expired grace window (Epic 7.12 session-expired path). */
export function clearResumeToken(level: string): void {
  sessionStorage.removeItem(`${RESUME_KEY}:${level}`);
  sessionStorage.removeItem(RESUME_KEY);
}
