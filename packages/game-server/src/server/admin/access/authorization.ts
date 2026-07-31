import { randomUUID } from "node:crypto";
import {
  createDebugFlags,
  type AdminCommand,
  type DebugFlags,
} from "@dc2d/engine";

const SPECTATOR_CAPABILITY = "spectator:use";
const WORLD_CAPABILITY = "world:edit";
const DEBUG_CAPABILITY = "debug:inspect";

export const ADMIN_CAPABILITIES = [
  "players:read",
  SPECTATOR_CAPABILITY,
  "players:teleport",
  "players:mutate",
  "enemies:kill",
  WORLD_CAPABILITY,
  DEBUG_CAPABILITY,
  "admins:grant",
] as const;

export type AdminCapability = typeof ADMIN_CAPABILITIES[number];

export interface AdminSession {
  readonly sessionId: string;
  readonly authenticatedAt: number;
  readonly capabilities: ReadonlySet<AdminCapability>;
  debugFlags: DebugFlags;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly code?: "unauthorized" | "forbidden";
}

export function createAdminSession(now = Date.now()): AdminSession {
  return {
    sessionId: randomUUID(),
    authenticatedAt: now,
    capabilities: new Set(ADMIN_CAPABILITIES),
    debugFlags: createDebugFlags(),
  };
}

export function authorizeAdminCommand(
  session: AdminSession | null,
  command: AdminCommand,
): AuthorizationDecision {
  if (!session) return { allowed: false, code: "unauthorized" };
  const required = capabilityFor(command);
  return session.capabilities.has(required)
    ? { allowed: true }
    : { allowed: false, code: "forbidden" };
}

function capabilityFor(command: AdminCommand): AdminCapability {
  return COMMAND_CAPABILITIES[command.op] ?? "players:mutate";
}

const COMMAND_CAPABILITIES: Readonly<Partial<Record<AdminCommand["op"], AdminCapability>>> = {
  list: "players:read",
  spectate: SPECTATOR_CAPABILITY,
  spectator: SPECTATOR_CAPABILITY,
  teleport: "players:teleport",
  map: WORLD_CAPABILITY,
  spawn: WORLD_CAPABILITY,
  despawn: WORLD_CAPABILITY,
  debug: DEBUG_CAPABILITY,
  killEnemies: "enemies:kill",
  assignAdmin: "admins:grant",
};
