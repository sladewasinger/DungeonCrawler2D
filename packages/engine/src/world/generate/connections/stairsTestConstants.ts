import { hashString } from "../../../core/rng.js";

export const STAIR_TEST_SEEDS = [
  hashString("dev-world-1"),
  hashString("stairs-invariant-a"),
  hashString("stairs-invariant-b"),
  hashString("stairs-invariant-c"),
  hashString("austin-dungeon-prod-1"),
];

export const STAIR_TEST_FLOOR = 1;
export const STAIR_TEST_CHUNK_RANGE = 6;
