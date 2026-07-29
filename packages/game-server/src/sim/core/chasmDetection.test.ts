import {
  TERRAIN,
  TILE,
  createBody,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { isBodyInChasm } from "./helpers.js";

describe("isBodyInChasm", () => {
  it("reads base terrain through a door feature overlay", () => {
    const world = {
      terrainAt: () => TERRAIN.Void,
      tileAt: () => TILE.DoorExit,
    };
    const body = createBody(4.5, 7.5, 0);
    body.grounded = true;

    expect(isBodyInChasm(world, body)).toBe(true);
  });

  it("does not kill an airborne body over VOID", () => {
    const body = createBody(4.5, 7.5, 0);
    body.grounded = false;

    expect(isBodyInChasm({ terrainAt: () => TERRAIN.Void }, body)).toBe(false);
  });
});
