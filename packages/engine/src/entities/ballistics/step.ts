import { GRAVITY } from "../../core/constants.js";
import type { WorldView } from "../../world/core/types.js";
import type { Entity } from "../entity.js";
import {
  ballisticVelocityAt,
} from "./resolution.js";
import type {
  BallisticFlight,
} from "./contract.js";
import {
  lastBallisticTracePoint,
  traceBallisticFlight,
} from "./trace.js";

export interface ProjectileStep {
  /** Reached ground or a wall — resolve the impact. */
  impact?: { x: number; y: number };
}

/** Advances a ballistic flight contract or legacy velocity-only projectile. */
export function stepProjectile(
  world: WorldView,
  projectile: Entity,
  dt: number,
): ProjectileStep {
  const flight = projectile.ballisticFlight;
  if (flight) return stepBallisticFlight({ world, projectile, flight, dt });
  return stepVelocityProjectile(world, projectile, dt);
}

interface BallisticStepRequest {
  readonly world: WorldView;
  readonly projectile: Entity;
  readonly flight: BallisticFlight;
  readonly dt: number;
}

function stepBallisticFlight({
  world,
  projectile,
  flight,
  dt,
}: BallisticStepRequest): ProjectileStep {
  const trace = traceBallisticFlight({
    world,
    flight,
    endTime: flight.elapsed + dt,
  });
  applyTracePoint(projectile, trace, flight);
  if (trace.impact === undefined) return {};
  return { impact: { x: trace.impact.x, y: trace.impact.y } };
}

function applyTracePoint(
  projectile: Entity,
  trace: ReturnType<typeof traceBallisticFlight>,
  flight: BallisticFlight,
): void {
  const point = trace.impact ?? lastBallisticTracePoint(trace);
  projectile.body.x = point.x;
  projectile.body.y = point.y;
  projectile.body.z = point.z;
  flight.elapsed = trace.elapsed;
  projectile.vel = ballisticVelocityAt(flight, trace.elapsed);
}

function stepVelocityProjectile(
  world: WorldView,
  projectile: Entity,
  dt: number,
): ProjectileStep {
  const vel = projectile.vel;
  if (!vel) return { impact: { x: projectile.body.x, y: projectile.body.y } };
  const next = nextVelocityPoint(projectile, vel, dt);
  if (blockedBySolidTile(world, next.x, next.y)) {
    return { impact: { x: projectile.body.x, y: projectile.body.y } };
  }
  projectile.body.x = next.x;
  projectile.body.y = next.y;
  projectile.body.z = next.z;
  vel.z -= GRAVITY * dt;
  return groundImpact(world, projectile);
}

function nextVelocityPoint(
  projectile: Entity,
  vel: NonNullable<Entity["vel"]>,
  dt: number,
): Readonly<{ x: number; y: number; z: number }> {
  return {
    x: projectile.body.x + vel.x * dt,
    y: projectile.body.y + vel.y * dt,
    z: projectile.body.z + vel.z * dt,
  };
}

function blockedBySolidTile(world: WorldView, x: number, y: number): boolean {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return !world.isWalkable(tileX, tileY) && world.heightAt(tileX, tileY) <= 0;
}

function groundImpact(world: WorldView, projectile: Entity): ProjectileStep {
  const terrain = world.groundAt(projectile.body.x, projectile.body.y);
  if (projectile.body.z > terrain) return {};
  projectile.body.z = terrain;
  return { impact: { x: projectile.body.x, y: projectile.body.y } };
}
