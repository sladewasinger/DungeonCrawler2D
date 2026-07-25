import { describe, expect, it } from "vitest";
import { RELEASE_NOTES_INDEX_PATH } from "./releaseNotesUrl.js";

describe("release notes URL", () => {
  it("targets the explicit S3 object instead of a directory route", () => {
    expect(RELEASE_NOTES_INDEX_PATH).toBe("/releases/index.html");
  });
});
