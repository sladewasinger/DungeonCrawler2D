import { describe, expect, it } from "vitest";
import { deriveCacheName, isDc2dCacheName } from "./cacheName.js";

describe("deriveCacheName", () => {
  it("keys the cache name on the given build sha", () => {
    expect(deriveCacheName("abc1234")).toBe("dc2d-cache-abc1234");
  });

  it("gives two different shas two different cache names", () => {
    expect(deriveCacheName("abc1234")).not.toBe(deriveCacheName("def5678"));
  });

  it("falls back to the dev sha unchanged", () => {
    expect(deriveCacheName("dev")).toBe("dc2d-cache-dev");
  });
});

describe("isDc2dCacheName", () => {
  it("recognizes this worker's own cache names", () => {
    expect(isDc2dCacheName(deriveCacheName("abc1234"))).toBe(true);
  });

  it("rejects unrelated cache names so activate cleanup never touches a stray cache", () => {
    expect(isDc2dCacheName("some-other-cache")).toBe(false);
    expect(isDc2dCacheName("dc2d-cache")).toBe(false);
  });
});
