import { describe, expect, it } from "vitest";
import { parseNote, publicReleaseNoteSource } from "./releaseNotesParser.js";

const note = `---
version: 1.2.3
date: 2026-07-25
title: Public Notes
---

## Added

- A public feature.
<!-- developer-only -->
- Internal implementation detail.
<!-- /developer-only -->

## Changed

- Improved network code.

## Removed

- An old limitation.

## Fixed

- A player-visible bug.
`;

describe("release note audiences", () => {
  it("keeps developer details in markdown source but omits them from public notes", () => {
    expect(note).toContain("Internal implementation detail");
    expect(publicReleaseNoteSource(note, "v1.2.3.md"))
      .not.toContain("Internal implementation detail");
    expect(parseNote(note, "v1.2.3.md").sections.Added)
      .toEqual(["A public feature."]);
  });

  it("rejects unmatched developer-only tags", () => {
    expect(() => publicReleaseNoteSource(
      "<!-- developer-only -->\n- hidden",
      "v1.2.3.md",
    )).toThrow("unmatched developer-only block");
  });
});
