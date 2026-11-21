import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { releaseNotesRequest } from "../build/releaseNotes.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const applicationVersion = "0.9.0";
const INDEX_PATH = "/releases/index.html";

function withReleaseFixture(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "dc2d-releases-"));
  try {
    const manifest = JSON.stringify({ version: applicationVersion });
    writeFileSync(join(root, "package.json"), manifest);
    for (const pkg of ["client", "content", "engine", "game-server"]) {
      mkdirSync(join(root, "packages", pkg), { recursive: true });
      writeFileSync(join(root, "packages", pkg, "package.json"), manifest);
    }
    mkdirSync(join(root, "docs", "releases"), { recursive: true });
    writeFileSync(
      join(root, "docs", "releases", `v${applicationVersion}.md`),
      `---\nversion: ${applicationVersion}\ndate: 2026-08-01\ntitle: Test Release\n---\n\n## Added\n\n- Test entry.\n\n## Changed\n\n- None.\n\n## Removed\n\n- None.\n\n## Fixed\n\n- None.\n`,
    );
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("release notes dev routes", () => {
  it("serves the generated index safely even when docs/releases is absent", () => {
    const response = releaseNotesRequest(
      repositoryRoot,
      applicationVersion,
      INDEX_PATH,
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
    expect(response?.body).not.toContain("src/main.ts");
  });

  it("serves version pages from a docs/releases fixture and redirects the directory", () => {
    withReleaseFixture((fixtureRoot) => {
      const index = releaseNotesRequest(fixtureRoot, applicationVersion, INDEX_PATH);
      expect(index?.body).toContain(`./v${applicationVersion}.html`);
      expect(releaseNotesRequest(
        fixtureRoot,
        applicationVersion,
        `/releases/v${applicationVersion}.html?from=title`,
      )?.body).toContain(`<h1>v${applicationVersion}`);
    });
    expect(releaseNotesRequest(repositoryRoot, applicationVersion, "/releases/")).toMatchObject({
      status: 302,
      headers: { location: INDEX_PATH },
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
