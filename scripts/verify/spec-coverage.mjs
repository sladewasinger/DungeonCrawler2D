/** Enforces REQ-ID traceability and completeness across phase specs and test reports. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { loadVerificationIndex } from "./reportReader.mjs";
import { findPhaseSpecFiles, parsePhaseSpec } from "./specParser.mjs";

const ROOT = process.cwd();

function validateAllSpecsSyntax(specs) {
  const seenIds = new Set();
  const errors = [];
  for (const spec of specs) {
    errors.push(...spec.errors);
    for (const req of spec.requirements) {
      if (seenIds.has(req.id)) errors.push(`Duplicate requirement ID: ${req.id}`);
      seenIds.add(req.id);
    }
  }
  return { totalReqs: seenIds.size, errors };
}

function checkLayerCoverage(opts) {
  const { req, layer, index, errors } = opts;
  if (layer === "static" && index.contentOk) return;
  const statuses = index.map.get(`${req.id}::${layer}`) ?? [];
  if (statuses.length === 0) {
    errors.push(`${req.id} missing test coverage for layer '${layer}'`);
    return;
  }
  if (statuses.some((s) => s !== "passed")) {
    errors.push(`${req.id} has non-passing test(s) for layer '${layer}': ${statuses.join(",")}`);
  }
}

function checkReqTargets(req, errors) {
  for (const target of req.targets) {
    if (!existsSync(resolve(ROOT, target))) {
      errors.push(`${req.id} declared missing target file: ${target}`);
    }
  }
}

function checkSpecCoverage(spec, index) {
  const errors = [];
  for (const req of spec.requirements) {
    checkReqTargets(req, errors);
    for (const layer of req.layers) checkLayerCoverage({ req, layer, index, errors });
  }
  return errors;
}

function selectTargetSpecs(specs, arg) {
  if (arg === "all") return specs.filter((s) => s.phaseNum >= 8);
  if (arg === "all-completed") return specs.filter((s) => s.phaseNum >= 8 && s.isCompleted);
  const match = arg.match(/^phase-(\d+)$/);
  if (!match) return null;
  const num = Number(match[1]);
  return specs.filter((s) => s.phaseNum === num);
}

function verifyTargets(specs, arg) {
  const targets = selectTargetSpecs(specs, arg);
  if (!targets || (arg !== "all-completed" && targets.length === 0)) {
    console.error(`[verify:spec] Unknown target '${arg}'. Use --check-specs, all-completed, all, or phase-<N>.`);
    process.exit(1);
  }
  const index = loadVerificationIndex(ROOT);
  const covErrors = targets.flatMap((s) => checkSpecCoverage(s, index));
  if (covErrors.length > 0) {
    for (const e of covErrors) console.error(`[verify:spec] GAP: ${e}`);
    process.exit(1);
  }
  const count = targets.reduce((n, s) => n + s.requirements.length, 0);
  console.log(`[verify:spec] PASS '${arg}' (${count} REQs verified)`);
}

function main() {
  const arg = process.argv[2] ?? "--check-specs";
  const specs = findPhaseSpecFiles(ROOT).map(parsePhaseSpec);
  const syntax = validateAllSpecsSyntax(specs);
  if (syntax.errors.length > 0) {
    for (const e of syntax.errors) console.error(`[verify:spec] SYNTAX ERROR: ${e}`);
    process.exit(1);
  }
  if (arg === "--check-specs") {
    console.log(`[verify:spec] PASS syntax check (${syntax.totalReqs} REQs across ${specs.length} specs)`);
    return;
  }
  verifyTargets(specs, arg);
}

main();
