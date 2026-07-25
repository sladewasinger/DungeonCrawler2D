import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Plugin } from "vite";

const REQUIRED_SECTIONS = ["Added", "Changed", "Removed", "Fixed"] as const;

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  sections: Record<(typeof REQUIRED_SECTIONS)[number], string[]>;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function parseFrontMatter(source: string, file: string): { attributes: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`[release-notes] ${file} is missing YAML front matter`);
  const attributes: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error(`[release-notes] invalid front matter in ${file}: ${line}`);
    attributes[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { attributes, body: match[2] };
}

function parseNote(source: string, file: string): ReleaseNote {
  const { attributes, body } = parseFrontMatter(source, file);
  validateAttributes(attributes, file);
  if (basename(file) !== `v${attributes.version}.md`) {
    throw new Error(`[release-notes] ${file} does not match version ${attributes.version}`);
  }
  return {
    version: attributes.version,
    date: attributes.date,
    title: attributes.title,
    sections: parseSections(body, file),
  };
}

function validateAttributes(attributes: Record<string, string>, file: string): void {
  for (const field of ["version", "date", "title"]) {
    if (!attributes[field]) throw new Error(`[release-notes] ${file} is missing ${field}`);
  }
}

function parseSections(body: string, file: string): ReleaseNote["sections"] {
  const sections = Object.fromEntries(REQUIRED_SECTIONS.map((name) => [name, []])) as ReleaseNote["sections"];
  let active: (typeof REQUIRED_SECTIONS)[number] | undefined;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      if (!REQUIRED_SECTIONS.includes(heading[1] as never)) {
        throw new Error(`[release-notes] unsupported section "${heading[1]}" in ${file}`);
      }
      active = heading[1] as (typeof REQUIRED_SECTIONS)[number];
      continue;
    }
    const item = /^- (.+)$/.exec(line);
    if (item && active) sections[active].push(item[1]);
  }
  for (const name of REQUIRED_SECTIONS) {
    if (sections[name].length === 0) throw new Error(`[release-notes] ${file} has an empty ${name} section`);
  }
  return sections;
}

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
  const cards = notes
    .map((note) => `<article><h2><a href="./v${escapeHtml(note.version)}.html">v${escapeHtml(note.version)} · ${escapeHtml(note.title)}</a></h2><time datetime="${escapeHtml(note.date)}">${escapeHtml(note.date)}</time></article>`)
    .join("");
  emit({
    type: "asset",
    fileName: "releases/index.html",
    source: page("DungeonCrawler2D Release Notes", `<h1>Release Notes</h1>${cards}<p><a href="/">Return to DungeonCrawler2D</a></p>`),
  });
  for (const note of notes) {
    emit({
      type: "asset",
      fileName: `releases/v${note.version}.html`,
      source: page(`DungeonCrawler2D v${note.version}`, noteBody(note)),
    });
  }
}
