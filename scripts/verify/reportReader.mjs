/** Reads Vitest, Playwright, Content Audit, and Visual QA JSON reports and indexes REQ coverage. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TAG_RE = /\[(REQ-P\d+-\d{2})\]/g;

function readJsonSafe(filePath) {
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf8")); } catch { return null; }
}

function recordEntry(map, entry) {
  const key = `${entry.reqId}::${entry.layer}`;
  const list = map.get(key) ?? [];
  list.push(entry.status);
  map.set(key, list);
}

function classifyVitestLayer(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("contentIntegrity.test.ts")) return "static";
  if (norm.includes("packages/game-server/")) return "sim";
  return "unit";
}

function ingestVitestAssertion(map, layer, assertion) {
  const title = `${assertion.fullName ?? ""} ${assertion.title ?? ""}`;
  const status = assertion.status ?? "unknown";
  for (const m of title.matchAll(TAG_RE)) {
    recordEntry(map, { reqId: m[1], layer, status });
  }
}

function ingestVitestReport(report, map) {
  for (const suite of report?.testResults ?? []) {
    const layer = classifyVitestLayer(suite.name ?? "");
    for (const assertion of suite.assertionResults ?? []) {
      ingestVitestAssertion(map, layer, assertion);
    }
  }
}

function normalizePwStatus(status) {
  if (status === "expected" || status === "passed") return "passed";
  if (status === "skipped" || status === "pending") return "skipped";
  return "failed";
}

function walkPlaywrightSuites(suites, map) {
  for (const suite of suites ?? []) {
    walkPlaywrightSuites(suite.suites, map);
    for (const spec of suite.specs ?? []) ingestPlaywrightSpec(spec, map);
  }
}

function ingestPlaywrightTest(map, tags, test) {
  const layer = test.projectName === "mobile" ? "e2e-mobile" : "e2e-desktop";
  const last = test.results?.[test.results.length - 1];
  const status = normalizePwStatus(last?.status ?? test.status ?? "failed");
  for (const reqId of tags) recordEntry(map, { reqId, layer, status });
}

function ingestPlaywrightSpec(spec, map) {
  const tags = [...(spec.title ?? "").matchAll(TAG_RE)].map((m) => m[1]);
  if (tags.length === 0) return;
  for (const test of spec.tests ?? []) ingestPlaywrightTest(map, tags, test);
}

function ingestManifestFile(map, manifestPath) {
  const manifest = readJsonSafe(manifestPath);
  for (const shot of manifest?.screenshots ?? []) {
    if (!shot.reqId) continue;
    recordEntry(map, { reqId: shot.reqId, layer: "visual", status: shot.entropyPassed ? "passed" : "failed" });
  }
}

function ingestVisualManifests(rootDir, map) {
  const qaRoot = resolve(rootDir, "artifacts/qa");
  if (!existsSync(qaRoot)) return;
  for (const entry of readdirSync(qaRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) ingestManifestFile(map, resolve(qaRoot, entry.name, "manifest.json"));
  }
}

export function loadVerificationIndex(rootDir) {
  const map = new Map();
  ingestVitestReport(readJsonSafe(resolve(rootDir, ".verify-reports/vitest.json")), map);
  const pw = readJsonSafe(resolve(rootDir, ".verify-reports/playwright.json"));
  walkPlaywrightSuites(pw?.suites, map);
  ingestVisualManifests(rootDir, map);
  const contentReport = readJsonSafe(resolve(rootDir, ".verify-reports/content.json"));
  return { map, contentOk: contentReport?.ok === true };
}
