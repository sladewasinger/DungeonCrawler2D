/** Browser-persisted identity: stable client id + session resume token. */

const RESUME_KEY = "dc2d-resume-token";
const CLIENT_ID_KEY = "dc2d-client-id";

export function persistentClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function loadResumeToken(): string | undefined {
  return sessionStorage.getItem(RESUME_KEY) ?? undefined;
}

export function saveResumeToken(token: string): void {
  sessionStorage.setItem(RESUME_KEY, token);
}
