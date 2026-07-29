import { TICK_DT } from "../../core/constants.js";
import { makeEntity } from "../entity.js";
import { createBody } from "../movement/index.js";
import {
  createBallisticFlight,
  resolveBallisticThrow,
  stepProjectile,
  traceBallisticFlight,
} from "../projectile.js";
import { describe, expect, it } from "vitest";
import { ballisticFixtures, type BallisticFixture } from "./flightFixtures.js";

function flyingBallisticProjectile(fixture: BallisticFixture) {
  const ballistic = resolveBallisticThrow({
    world: fixture.world,
    from: fixture.from,
    target: fixture.target,
  });
  const body = createBody(fixture.from.x, fixture.from.y, fixture.from.z);
  body.grounded = false;
  return makeEntity("projectile", body, {
    vel: ballistic.vel,
    ballisticFlight: createBallisticFlight(fixture.from, ballistic),
  });
}

function stepToImpact(fixture: BallisticFixture) {
  const projectile = flyingBallisticProjectile(fixture);
  for (let step = 0; step < 40; step++) {
    if (stepProjectile(fixture.world, projectile, TICK_DT).impact !== undefined) {
      return projectile;
    }
  }
  throw new Error(`Ballistic ${fixture.name} did not land in 40 production ticks`);
}

describe("ballistic flight contract", () => {
  it.each(ballisticFixtures)("uses the 50ms authoritative trace for $name throws", (fixture) => {
    const projectile = stepToImpact(fixture);
    const ballistic = resolveBallisticThrow({
      world: fixture.world,
      from: fixture.from,
      target: fixture.target,
    });
    const trace = traceBallisticFlight({
      world: fixture.world,
      flight: createBallisticFlight(fixture.from, ballistic),
    });
    const expected = trace.impact ?? ballistic.target;

    expect(projectile.body.x).toBeCloseTo(expected.x, 8);
    expect(projectile.body.y).toBeCloseTo(expected.y, 8);
    expect(projectile.body.z).toBeCloseTo(expected.z, 8);
  });
});
