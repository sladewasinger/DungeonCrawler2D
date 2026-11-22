/** Exponential smoothing for remote multiplayer players between 20 Hz server snapshots. */
import type { PlayerSnapshot } from "@dc2d/engine";

interface InterpTrack {
  x: number;
  y: number;
  elevation: number;
  jumpZ: number;
  jumpVz: number;
  facingX: number;
  facingY: number;
  aimX: number;
  aimY: number;
  tx: number;
  ty: number;
  tElevation: number;
  tJumpZ: number;
  tJumpVz: number;
  tFacingX: number;
  tFacingY: number;
  tAimX: number;
  tAimY: number;
}

function snapTrack(p: PlayerSnapshot): InterpTrack {
  const aimX = p.aimX ?? p.facingX;
  const aimY = p.aimY ?? p.facingY;
  const jumpZ = p.jumpZ ?? 0;
  const jumpVz = p.jumpVz ?? 0;
  return {
    x: p.x, y: p.y, elevation: p.elevation, jumpZ, jumpVz,
    facingX: p.facingX, facingY: p.facingY, aimX, aimY,
    tx: p.x, ty: p.y, tElevation: p.elevation, tJumpZ: jumpZ, tJumpVz: jumpVz,
    tFacingX: p.facingX, tFacingY: p.facingY, tAimX: aimX, tAimY: aimY,
  };
}

function setTrackTarget(track: InterpTrack, p: PlayerSnapshot): void {
  const aimX = p.aimX ?? p.facingX;
  const aimY = p.aimY ?? p.facingY;
  const jumpZ = p.jumpZ ?? 0;
  const jumpVz = p.jumpVz ?? 0;
  if (Math.hypot(p.x - track.x, p.y - track.y) > 3.5) {
    Object.assign(track, snapTrack(p));
    return;
  }
  track.tx = p.x;
  track.ty = p.y;
  track.tElevation = p.elevation;
  track.tJumpZ = jumpZ;
  track.tJumpVz = jumpVz;
  track.tFacingX = p.facingX;
  track.tFacingY = p.facingY;
  track.tAimX = aimX;
  track.tAimY = aimY;
}

function blendTrack(track: InterpTrack, dt: number): void {
  const t = 1 - Math.exp(-16 * dt);
  const aimT = 1 - Math.exp(-20 * dt);
  track.x += (track.tx - track.x) * t;
  track.y += (track.ty - track.y) * t;
  track.elevation += (track.tElevation - track.elevation) * t;
  track.jumpZ += (track.tJumpZ - track.jumpZ) * t;
  track.jumpVz += (track.tJumpVz - track.jumpVz) * t;
  track.facingX += (track.tFacingX - track.facingX) * aimT;
  track.facingY += (track.tFacingY - track.facingY) * aimT;
  track.aimX += (track.tAimX - track.aimX) * aimT;
  track.aimY += (track.tAimY - track.aimY) * aimT;
}

export class RemotePlayerSmoother {
  private readonly tracks = new Map<string, InterpTrack>();

  setTargets(players: readonly PlayerSnapshot[], localPlayerId: string): void {
    const active = new Set<string>();
    for (const p of players) {
      if (p.id !== localPlayerId) {
        active.add(p.id);
        this.upsertTrack(p);
      }
    }
    this.pruneInactive(active);
  }

  private upsertTrack(p: PlayerSnapshot): void {
    const existing = this.tracks.get(p.id);
    if (existing) setTrackTarget(existing, p);
    else this.tracks.set(p.id, snapTrack(p));
  }

  private pruneInactive(active: ReadonlySet<string>): void {
    for (const id of this.tracks.keys()) {
      if (!active.has(id)) this.tracks.delete(id);
    }
  }

  step(dt: number): void {
    for (const track of this.tracks.values()) blendTrack(track, dt);
  }

  resolve(raw: PlayerSnapshot): PlayerSnapshot {
    const s = this.tracks.get(raw.id);
    if (!s) return raw;
    const residual = Math.hypot(s.tx - s.x, s.ty - s.y);
    return {
      ...raw,
      x: s.x,
      y: s.y,
      elevation: s.elevation,
      jumpZ: s.jumpZ,
      jumpVz: s.jumpVz,
      facingX: s.facingX,
      facingY: s.facingY,
      aimX: s.aimX,
      aimY: s.aimY,
      moving: raw.moving || residual > 0.03,
    };
  }
}
