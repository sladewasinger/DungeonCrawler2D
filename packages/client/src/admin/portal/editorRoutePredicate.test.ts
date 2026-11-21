import { describe, expect, it } from "vitest";
import { isEditorRoute } from "./editorRoutePredicate.js";

describe("editor route", () => {
  it("recognizes the standalone editor path", () => {
    expect(isEditorRoute({ pathname: "/editor", hostname: "localhost" })).toBe(true);
    expect(isEditorRoute({ pathname: "/editor", hostname: "127.0.0.1" })).toBe(true);
    expect(isEditorRoute({ pathname: "/editor", hostname: "example.test" })).toBe(false);
    expect(isEditorRoute({ pathname: "/admin", hostname: "localhost" })).toBe(false);
    expect(isEditorRoute({ pathname: "/", hostname: "localhost" })).toBe(false);
  });
});
