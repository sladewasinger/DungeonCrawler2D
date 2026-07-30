import { basename } from "node:path";
import {
  parseReleaseNoteSections,
  type ReleaseNoteSections,
} from "./releaseNoteSections.js";
export { REQUIRED_SECTIONS } from "./releaseNoteSections.js";

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  sections: ReleaseNoteSections;
}

interface ReleaseAttributes {
  version: string;
  date: string;
  title: string;
}

const DEVELOPER_BLOCK =
  /<!--\s*developer-only\s*-->[\s\S]*?<!--\s*\/developer-only\s*-->/gi;

export function publicReleaseNoteSource(body: string, file: string): string {
  const opening = (body.match(/<!--\s*developer-only\s*-->/gi) ?? []).length;
  const closing = (body.match(/<!--\s*\/developer-only\s*-->/gi) ?? []).length;
  if (opening !== closing) {
    throw new Error(
      `[release-notes] ${file} has an unmatched developer-only block`,
    );
  }
  return body.replace(DEVELOPER_BLOCK, "");
}

function parseFrontMatter(
  source: string,
  file: string,
): { attributes: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) {
    throw new Error(`[release-notes] ${file} is missing YAML front matter`);
  }
  const attributesSource = match[1];
  const body = match[2];
  if (attributesSource === undefined || body === undefined) {
    throw new Error(`[release-notes] ${file} has invalid YAML front matter`);
  }
  const attributes: Record<string, string> = {};
  for (const line of attributesSource.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      throw new Error(`[release-notes] invalid front matter in ${file}: ${line}`);
    }
    attributes[line.slice(0, separator).trim()] =
      line.slice(separator + 1).trim();
  }
  return { attributes, body };
}

function validateAttributes(
  attributes: Record<string, string>,
  file: string,
): asserts attributes is Record<string, string> & ReleaseAttributes {
  for (const field of ["version", "date", "title"]) {
    if (!attributes[field]) {
      throw new Error(`[release-notes] ${file} is missing ${field}`);
    }
  }
}

function parseSections(body: string, file: string): ReleaseNote["sections"] {
  const publicBody = publicReleaseNoteSource(body, file);
  return parseReleaseNoteSections(publicBody, file);
}

export function parseNote(source: string, file: string): ReleaseNote {
  const { attributes, body } = parseFrontMatter(source, file);
  validateAttributes(attributes, file);
  if (basename(file) !== `v${attributes.version}.md`) {
    throw new Error(
      `[release-notes] ${file} does not match version ${attributes.version}`,
    );
  }
  return {
    version: attributes.version,
    date: attributes.date,
    title: attributes.title,
    sections: parseSections(body, file),
  };
}
