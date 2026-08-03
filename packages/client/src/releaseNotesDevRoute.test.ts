import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { releaseNotesRequest } from "../build/releaseNotes.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const applicationVersion = "0.9.0";

describe("release notes dev routes", () => {
  it("serves the generated index instead of falling through to the game shell", () => {
    const response = releaseNotesRequest(
      repositoryRoot,
      applicationVersion,
      "/releases/index.html",
    );

    expect(response).toMatchObject({
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
    expect(response?.body).toContain('href="/">← Back to title screen</a>');
    expect(response?.body).toContain("<h1>Release Notes</h1>");
    expect(response?.body).toContain(`./v${applicationVersion}.html`);
    expect(response?.body).not.toContain("src/main.ts");
  });

  it("serves version pages with query strings and redirects the directory", () => {
    expect(releaseNotesRequest(
      repositoryRoot,
      applicationVersion,
      `/releases/v${applicationVersion}.html?from=title`,
    )?.body).toContain(`<h1>v${applicationVersion}`);
    expect(releaseNotesRequest(repositoryRoot, applicationVersion, "/releases/")).toMatchObject({
      status: 302,
      headers: { location: "/releases/index.html" },
    });
  });

  it("leaves game and asset routes to Vite", () => {
    expect(releaseNotesRequest(repositoryRoot, applicationVersion, "/")).toBeNull();
    expect(releaseNotesRequest(
      repositoryRoot,
      applicationVersion,
      "/assets/atlas.json",
    )).toBeNull();
  });
});
