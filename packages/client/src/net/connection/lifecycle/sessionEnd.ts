import type { Connection } from "../connection.js";

const EXPIRED_SESSION_MESSAGE = "Session expired — reconnect below";

export function consumeSessionEndMessage(connection: Connection): string | null {
  if (!connection.sessionExpired) return null;
  const message = connection.sessionEndMessage ?? EXPIRED_SESSION_MESSAGE;
  connection.sessionExpired = false;
  connection.sessionEndMessage = null;
  return message;
}
