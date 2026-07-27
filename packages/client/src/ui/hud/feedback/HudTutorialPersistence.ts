import type { TutorialId, TutorialMessage } from "../../../ui/tutorials/model.js";

const STORAGE_KEY = "dc2d.hud.tutorials.v2";
const HISTORY_STORAGE_KEY = "dc2d.hud.tutorial-history.v2";

export const loadSeenTutorials = (): Set<TutorialId> => loadTutorialValue(STORAGE_KEY, (value) =>
  Array.isArray(value) ? new Set(value.filter((entry): entry is TutorialId => typeof entry === "string")) : new Set(),
);

export const loadTutorialHistory = (): Map<TutorialId, TutorialMessage> => loadTutorialValue(HISTORY_STORAGE_KEY, (value) => {
  if (!Array.isArray(value)) return new Map();
  const messages = value.filter(isPersistentTutorial);
  return new Map(messages.map((message) => [message.id, message]));
});

const loadTutorialValue = <Value>(key: string, parse: (value: unknown) => Value): Value => {
  try { return parse(JSON.parse(localStorage.getItem(key) ?? "[]") as unknown); }
  catch { return parse([]); }
};

const isPersistentTutorial = (entry: unknown): entry is TutorialMessage =>
  typeof entry === "object" && entry !== null &&
  typeof (entry as TutorialMessage).id === "string" &&
  typeof (entry as TutorialMessage).text === "string" &&
  (entry as TutorialMessage).persistent === true;

export const persistSeenTutorials = (seen: Set<TutorialId>): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
};

export const persistTutorialHistory = (history: Map<TutorialId, TutorialMessage>): void => {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([...history.values()]));
};

export const clearSeenTutorials = (): void => localStorage.removeItem(STORAGE_KEY);
