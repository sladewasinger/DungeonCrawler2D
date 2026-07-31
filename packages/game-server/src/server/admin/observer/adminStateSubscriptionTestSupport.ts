import { WebSocket } from "ws";
import type { AdminSessionRegistry } from "../access/sessionRegistry.js";
import type { ConnState } from "../../types.js";
import { AdminStateSubscriptions } from "./adminStateSubscriptions.js";

export function authenticatedAdminStateSubscriptions(input: {
  readonly sessions: AdminSessionRegistry;
  readonly socket: WebSocket;
  readonly conn: ConnState;
}): AdminStateSubscriptions {
  const session = input.conn.adminSession;
  if (!session) throw new Error("expected admin session");
  input.sessions.issue({ session, peerAddress: input.conn.peerAddress });
  input.sessions.bind({
    session,
    peerAddress: input.conn.peerAddress,
    binding: input.socket,
    onInvalidated: () => { input.conn.adminSession = null; },
  });
  const subscriptions = new AdminStateSubscriptions(input.sessions);
  subscriptions.add(input.socket, input.conn);
  return subscriptions;
}

export class ObserverSocket {
  readonly OPEN = WebSocket.OPEN;
  readonly bufferedAmount = 0;
  readonly sent: string[] = [];
  readyState = WebSocket.OPEN;

  send(message: string): void {
    this.sent.push(message);
  }
}
