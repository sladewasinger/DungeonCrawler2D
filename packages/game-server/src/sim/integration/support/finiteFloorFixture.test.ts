import { hashString } from "@dc2d/engine";
import { expect, it } from "vitest";
import {
  integrationDungeonFixtureCacheHits,
  loadIntegrationDungeonFixture,
} from "./finiteFloorFixture.js";

it("reuses an identity-validated serialized floor fixture", () => {
  const before = integrationDungeonFixtureCacheHits();
  const first = loadIntegrationDungeonFixture(hashString("fixture-cache-hit"), 1);
  const second = loadIntegrationDungeonFixture(hashString("fixture-cache-hit"), 1);

  expect(integrationDungeonFixtureCacheHits()).toBeGreaterThan(before);
  expect(second.identity.fingerprint).toBe(first.identity.fingerprint);
  expect(second.identity.configurationFingerprint).toBe(first.identity.configurationFingerprint);
});
