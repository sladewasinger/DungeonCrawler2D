export const REQUIRED_SECTIONS = [
  "Added",
  "Changed",
  "Removed",
  "Fixed",
] as const;

export type ReleaseSectionName = (typeof REQUIRED_SECTIONS)[number];
export type ReleaseNoteSections = Record<ReleaseSectionName, string[]>;

interface SectionCursor {
  section?: ReleaseSectionName;
  itemIndex?: number;
}

interface ActiveSectionCursor extends SectionCursor {
  section: ReleaseSectionName;
}

interface SectionLineInput {
  line: string;
  file: string;
  cursor: SectionCursor;
  sections: ReleaseNoteSections;
}

export function parseReleaseNoteSections(
  body: string,
  file: string,
): ReleaseNoteSections {
  const sections = emptySections();
  let cursor: SectionCursor = {};
  for (const line of body.split(/\r?\n/)) {
    cursor = parseSectionLine({ line, file, cursor, sections });
  }
  for (const name of REQUIRED_SECTIONS) {
    if (sections[name].length === 0) {
      throw new Error(`[release-notes] ${file} has an empty ${name} section`);
    }
  }
  return sections;
}

function emptySections(): ReleaseNoteSections {
  return { Added: [], Changed: [], Removed: [], Fixed: [] };
}

function parseSectionLine({
  line,
  file,
  cursor,
  sections,
}: SectionLineInput): SectionCursor {
  const heading = sectionHeading(line, file);
  if (heading) return { section: heading };
  if (cursor.section === undefined) return {};
  const activeCursor = activeSectionCursor(cursor);
  return parseActiveSectionLine(line, activeCursor, sections[activeCursor.section]);
}

function activeSectionCursor(cursor: SectionCursor): ActiveSectionCursor {
  const section = cursor.section;
  if (section === undefined) {
    throw new Error("[release-notes] cannot parse an inactive section");
  }
  if (cursor.itemIndex === undefined) return { section };
  return { section, itemIndex: cursor.itemIndex };
}

function sectionHeading(
  line: string,
  file: string,
): ReleaseSectionName | undefined {
  const sectionName = /^## (.+)$/.exec(line)?.[1];
  if (sectionName === undefined) return undefined;
  if (REQUIRED_SECTIONS.some((name) => name === sectionName)) {
    return sectionName as ReleaseSectionName;
  }
  throw new Error(
    `[release-notes] unsupported section "${sectionName}" in ${file}`,
  );
}

function parseActiveSectionLine(
  line: string,
  cursor: ActiveSectionCursor,
  items: string[],
): SectionCursor {
  const item = /^- (.+)$/.exec(line)?.[1];
  if (item) {
    items.push(item);
    return { section: cursor.section, itemIndex: items.length - 1 };
  }
  const continuation = /^\s{2,}(\S.*)$/.exec(line)?.[1];
  if (!continuation || cursor.itemIndex === undefined) {
    return { section: cursor.section };
  }
  const itemToContinue = items[cursor.itemIndex];
  if (itemToContinue === undefined) return { section: cursor.section };
  items[cursor.itemIndex] = `${itemToContinue} ${continuation}`;
  return cursor;
}
