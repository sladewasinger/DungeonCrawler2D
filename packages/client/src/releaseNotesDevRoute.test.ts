import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { releaseNotesRequest } from "../build/releaseNotes.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("release notes dev routes", () => {
  it("serves the generated index instead of falling through to the game shell", () => {
    const response = releaseNotesRequest(
      repositoryRoot,
      "0.5.0",
      "/releases/index.html",
    );

    expect(response).toMatchObject({
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
    expect(response?.body).toContain("<h1>Release Notes</h1>");
    expect(response?.body).toContain("./v0.5.0.html");
    expect(response?.body).not.toContain("src/main.ts");
  });

  it("serves version pages with query strings and redirects the directory", () => {
    expect(releaseNotesRequest(
      repositoryRoot,
      "0.5.0",
      "/releases/v0.5.0.html?from=title",
    )?.body).toContain("<h1>v0.5.0");
    expect(releaseNotesRequest(
      repositoryRoot,
      "0.5.0",
      "/releases/",
    )).toMatchObject({
      status: 302,
      headers: { location: "/releases/index.html" },
    });
  });

  it("leaves game and asset routes to Vite", () => {
    expect(releaseNotesRequest(repositoryRoot, "0.5.0", "/")).toBeNull();
    expect(releaseNotesRequest(
      repositoryRoot,
      "0.5.0",
      "/assets/atlas.json",
    )).toBeNull();
  });
});
