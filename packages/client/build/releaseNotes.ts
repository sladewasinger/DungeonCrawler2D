import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import {
  parseNote,
  REQUIRED_SECTIONS,
  type ReleaseNote,
} from "./releaseNotesParser.js";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const style = `
  :root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0d0e16;color:#f2f0eb}
  body{margin:0;padding:48px 24px}main{width:min(760px,100%);margin:auto}
  a{color:#ffd23d;text-underline-offset:3px}article{background:#171824;border:1px solid #494956;padding:24px;margin:20px 0}
  h1,h2{color:#ffd23d}time{color:#aaaabd}li{margin:.6rem 0;line-height:1.5}
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><main>${body}</main></body></html>`;
}

function noteBody(note: ReleaseNote): string {
  const sections = REQUIRED_SECTIONS.map((name) => {
    const items = note.sections[name].map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    return `<section><h2>${name}</h2><ul>${items}</ul></section>`;
  }).join("");
  return `<p><a href="./index.html">← All releases</a></p><article><h1>v${escapeHtml(note.version)} · ${escapeHtml(note.title)}</h1><time datetime="${escapeHtml(note.date)}">${escapeHtml(note.date)}</time>${sections}</article><p><a href="/">Return to DungeonCrawler2D</a></p>`;
}

export function releaseNotesPlugin(repositoryRoot: string, applicationVersion: string): Plugin {
  return {
    name: "release-notes",
    buildStart() {
      validateManifestVersions(repositoryRoot, applicationVersion);
      const notes = loadReleaseNotes(repositoryRoot, applicationVersion);
      emitReleasePages(notes, (asset) => this.emitFile(asset));
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rendered = releaseNotesRequest(
          repositoryRoot,
          applicationVersion,
          request.url ?? "/",
        );
        if (!rendered) return next();
        response.statusCode = rendered.status;
        for (const [name, value] of Object.entries(rendered.headers)) {
          response.setHeader(name, value);
        }
        response.end(rendered.body);
      });
    },
  };
}

export interface ReleaseNotesHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function releaseNotesRequest(
  repositoryRoot: string,
  applicationVersion: string,
  requestUrl: string,
): ReleaseNotesHttpResponse | null {
  const path = new URL(requestUrl, "http://release-notes.local").pathname;
  if (path === "/releases" || path === "/releases/") return releasesRedirect();
  if (!path.startsWith("/releases/") || !path.endsWith(".html")) return null;
  return releasePageResponse(repositoryRoot, applicationVersion, path);
}

function releasesRedirect(): ReleaseNotesHttpResponse {
  return {
    status: 302,
    headers: { location: "/releases/index.html", "cache-control": "no-store" },
    body: "",
  };
}

function releasePageResponse(
  repositoryRoot: string,
  applicationVersion: string,
  path: string,
): ReleaseNotesHttpResponse | null {
  validateManifestVersions(repositoryRoot, applicationVersion);
  const fileName = path.slice(1);
  const asset = releaseAssets(
    loadReleaseNotes(repositoryRoot, applicationVersion),
  ).find((candidate) => candidate.fileName === fileName);
  if (!asset) return null;
  return {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
    body: asset.source,
  };
}

function validateManifestVersions(repositoryRoot: string, applicationVersion: string): void {
  const manifests = [
    "package.json",
    "packages/client/package.json",
    "packages/content/package.json",
    "packages/engine/package.json",
    "packages/game-server/package.json",
  ];
  for (const manifest of manifests) {
    const parsed = JSON.parse(readFileSync(resolve(repositoryRoot, manifest), "utf8")) as { version?: string };
    if (parsed.version !== applicationVersion) {
      throw new Error(`[release-notes] ${manifest} version ${parsed.version ?? "missing"} does not match ${applicationVersion}`);
    }
  }
}

function loadReleaseNotes(repositoryRoot: string, applicationVersion: string): ReleaseNote[] {
  const directory = resolve(repositoryRoot, "docs/releases");
  const notes = readdirSync(directory)
    .filter((name) => /^v\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => parseNote(readFileSync(resolve(directory, name), "utf8"), name))
    .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }));
  if (!notes.some((note) => note.version === applicationVersion)) {
    throw new Error(`[release-notes] v${applicationVersion}.md is required for this build`);
  }
  return notes;
}

interface ReleaseAsset {
  type: "asset";
  fileName: string;
  source: string;
}

function emitReleasePages(notes: ReleaseNote[], emit: (asset: ReleaseAsset) => unknown): void {
  for (const asset of releaseAssets(notes)) emit(asset);
}

function releaseAssets(notes: ReleaseNote[]): ReleaseAsset[] {
  const cards = notes
    .map((note) => `<article><h2><a href="./v${escapeHtml(note.version)}.html">v${escapeHtml(note.version)} · ${escapeHtml(note.title)}</a></h2><time datetime="${escapeHtml(note.date)}">${escapeHtml(note.date)}</time></article>`)
    .join("");
  const assets: ReleaseAsset[] = [{
    type: "asset",
    fileName: "releases/index.html",
    source: page("DungeonCrawler2D Release Notes", `<p><a href="/">← Back to title screen</a></p><h1>Release Notes</h1>${cards}<p><a href="/">Return to DungeonCrawler2D</a></p>`),
  }];
  for (const note of notes) {
    assets.push({
      type: "asset",
      fileName: `releases/v${note.version}.html`,
      source: page(`DungeonCrawler2D v${note.version}`, noteBody(note)),
    });
  }
  return assets;
}
