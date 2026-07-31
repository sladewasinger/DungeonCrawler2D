import { describe, expect, it } from "vitest";
import { isAdminRoute } from "./routePredicate.js";

describe("admin route", () => {
  it("recognizes the dedicated path and explicit query toggle", () => {
    expect(isAdminRoute({ pathname: "/admin", search: "" })).toBe(true);
    expect(isAdminRoute({ pathname: "/", search: "?admin=1" })).toBe(true);
    expect(isAdminRoute({ pathname: "/", search: "" })).toBe(false);
  });
});
