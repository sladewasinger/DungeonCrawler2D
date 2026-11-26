/** Parses phase specification markdown files and validates REQ traceability tables and links. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const VALID_LAYERS = new Set(["unit", "sim", "static", "e2e-desktop", "e2e-mobile", "visual"]);
const TABLE_HEADER = "| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |";
const REQ_ROW_RE = /^\| `(REQ-P\d+-\d{2})`/;
const LINK_RE = /\[[^\]]+\]\(([^)#\s]+)(?:#[^)]+)?\)/g;

export function findPhaseSpecFiles(rootDir) {
  const dir = resolve(rootDir, "docs/phases");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^phase-\d+-.*\.md$/.test(f))
    .sort((a, b) => Number(a.match(/^phase-(\d+)-/)[1]) - Number(b.match(/^phase-(\d+)-/)[1]))
    .map((f) => resolve(dir, f));
}

function checkBrokenLinks(text, filePath, errors) {
  const dir = dirname(filePath);
  for (const match of text.matchAll(LINK_RE)) {
    const target = match[1];
    if (!target || target.startsWith("http://") || target.startsWith("https://")) continue;
    if (!existsSync(resolve(dir, target))) errors.push(`Broken markdown link in ${filePath}: ${target}`);
  }
}

function parseReqRow(opts) {
  const { row, idx, phaseNum, filePath, errors } = opts;
  const cols = row.split("|").slice(1, -1).map((c) => c.trim());
  if (cols.length !== 5) { errors.push(`Invalid column count in ${filePath}: ${row}`); return null; }
  const id = cols[0].replace(/`/g, "");
  const expected = `REQ-P${phaseNum}-${String(idx + 1).padStart(2, "0")}`;
  if (id !== expected) errors.push(`Sequential ID mismatch in ${filePath}: got ${id}, expected ${expected}`);
  const layers = cols[3].split(",").map((s) => s.trim().replace(/`/g, "")).filter(Boolean);
  for (const layer of layers) {
    if (!VALID_LAYERS.has(layer)) errors.push(`Invalid layer '${layer}' on ${id}`);
  }
  const targets = cols[4].split(",").map((s) => s.trim().replace(/`/g, "")).filter(Boolean);
  if (targets.length === 0) errors.push(`Missing automated test target on ${id}`);
  return { id, domain: cols[1], criteria: cols[2], layers, targets };
}

function parseStatusFlag(text) {
  const line = text.split(/\r?\n/).find((l) => l.startsWith("> **Status**:")) ?? "";
  return line.includes("✅") && line.toLowerCase().includes("complete");
}

export function parsePhaseSpec(filePath) {
  const match = filePath.match(/phase-(\d+)-/);
  const phaseNum = match ? Number(match[1]) : 0;
  const text = readFileSync(filePath, "utf8");
  const errors = [];
  checkBrokenLinks(text, filePath, errors);
  const hasTable = text.includes(TABLE_HEADER);
  if (phaseNum >= 8 && !hasTable) errors.push(`Missing Requirement Traceability Table header in ${filePath}`);
  const rows = text.split(/\r?\n/).filter((l) => REQ_ROW_RE.test(l));
  if (phaseNum >= 8 && rows.length === 0) errors.push(`No REQ rows found in ${filePath}`);
  const requirements = rows
    .map((row, idx) => parseReqRow({ row, idx, phaseNum, filePath, errors }))
    .filter(Boolean);
  return { phaseNum, filePath, isCompleted: parseStatusFlag(text), requirements, errors };
}
