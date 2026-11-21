import {
  MOVE_SPEED,
  createDebugFlags,
  type ServerSnapshot,
} from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";

export function applyVitals(conn: Connection, snap: ServerSnapshot): void {
  const wasDead = conn.hp <= 0;
  conn.hp = snap.self.hp;
  conn.maxHp = snap.self.maxHp;
  applyActiveAdminState(conn, snap);
  applyStaminaState(conn, snap);
  applyStatusState(conn, snap);
  applySpectatorPresentation(conn, snap);
  if (wasDead && conn.hp > 0) conn.justRespawned = true;
  applyLifeState(conn, snap);
}

function applySpectatorPresentation(
  conn: Connection,
  snap: ServerSnapshot,
): void {
  conn.spectatorTargetPose = {
    x: snap.self.x,
    y: snap.self.y,
    z: snap.self.z,
  };
  conn.spectatorFacingX = snap.self.faceX ?? conn.spectatorFacingX;
  conn.spectatorFacingY = snap.self.faceY ?? conn.spectatorFacingY;
  conn.spectatorAttacking = snap.self.attacking ?? false;
}

function applyActiveAdminState(conn: Connection, snap: ServerSnapshot): void {
  conn.activeAdmin = snap.self.admin === true;
  conn.noclip = conn.activeAdmin && snap.self.noclip === true;
  conn.activeAdminDebugFlags = conn.activeAdmin
    ? snap.self.adminDebug ?? createDebugFlags()
    : createDebugFlags();
  conn.activeAdminDebugEntities = conn.activeAdmin
    ? snap.self.adminDebugEntities ?? []
    : [];
}

function applyStaminaState(conn: Connection, snap: ServerSnapshot): void {
  conn.stamina = snap.self.stamina ?? conn.stamina;
  conn.maxStamina = snap.self.maxStamina ?? conn.maxStamina;
  conn.blocking = snap.self.blocking ?? false;
  conn.staminaRecoveryDelaySeconds = snap.self.staminaRecoveryDelaySeconds ?? conn.staminaRecoveryDelaySeconds;
  conn.staminaExhausted = snap.self.staminaExhausted ?? conn.staminaExhausted;
}

function applyStatusState(conn: Connection, snap: ServerSnapshot): void {
  conn.healthRegenerationDelaySeconds = snap.self.healthRegenerationDelaySeconds ?? conn.healthRegenerationDelaySeconds;
  conn.movementSpeed = snap.self.movementSpeed ?? MOVE_SPEED;
  conn.fx = snap.self.fx;
  conn.statusEffects = snap.self.statusEffects ?? snap.self.fx.map((id) => ({
    id,
    remainingSeconds: null,
    durationSeconds: null,
  }));
}

function applyLifeState(conn: Connection, snap: ServerSnapshot): void {
  conn.downed = snap.self.downed ?? false;
  conn.downedUntilTick = snap.self.downedUntilTick ?? null;
  conn.reviveProgress = snap.self.reviveProgress ?? 0;
  conn.reviverName = snap.self.reviverName ?? null;
  conn.respawnAtTick = snap.self.respawnAtTick ?? null;
}
