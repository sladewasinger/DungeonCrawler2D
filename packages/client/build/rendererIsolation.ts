/** Verifies and records that production renderer routes load only their own runtime. */
import type { OutputBundle, OutputChunk } from "rollup";
import type { Plugin } from "vite";

type Renderer = "phaser" | "three";

interface RouteEvidence {
  file: string;
  bytes: number;
  staticImports: string[];
  runtimes: Renderer[];
}

const MODULE_SUFFIX = {
  main: "/src/main.ts",
  phaser: "/src/phaser/PhaserRoute.ts",
  three: "/src/three/ThreeRoute.ts",
} as const;

export function rendererIsolation(): Plugin {
  return {
    name: "verify-renderer-isolation",
    generateBundle(_options, bundle): void {
      this.emitFile(rendererIsolationAsset(bundle));
    },
  };
}

function rendererIsolationAsset(bundle: OutputBundle): { type: "asset"; fileName: string; source: string } {
  const chunks = outputChunks(bundle);
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const routes = routeClosures(chunks, byFile);
  assertRouteIsolation(routes);
  return {
    type: "asset",
    fileName: "renderer-isolation.json",
    source: `${JSON.stringify({ entry: evidence(routes.main), routes: { phaser: evidence(routes.phaser), three: evidence(routes.three) } }, null, 2)}\n`,
  };
}

interface RouteClosures { main: OutputChunk[]; phaser: OutputChunk[]; three: OutputChunk[]; }

function routeClosures(chunks: OutputChunk[], byFile: ReadonlyMap<string, OutputChunk>): RouteClosures {
  const main = routeChunk(chunks, MODULE_SUFFIX.main);
  const phaser = routeChunk(chunks, MODULE_SUFFIX.phaser);
  const three = routeChunk(chunks, MODULE_SUFFIX.three);
  assertDynamicRoute(main, phaser);
  assertDynamicRoute(main, three);
  return { main: staticClosure(main, byFile), phaser: staticClosure(phaser, byFile), three: staticClosure(three, byFile) };
}

function assertRouteIsolation({ main, phaser, three }: RouteClosures): void {
  assertRuntimes("entry", main, []);
  assertRuntimes("Phaser", phaser, ["phaser"]);
  assertRuntimes("Three", three, ["three"]);
}

function outputChunks(bundle: OutputBundle): OutputChunk[] {
  return Object.values(bundle).filter((entry): entry is OutputChunk => entry.type === "chunk");
}

function routeChunk(chunks: OutputChunk[], suffix: string): OutputChunk {
  const found = chunks.find((chunk) =>
    Object.keys(chunk.modules).some((id) => normalized(id).endsWith(suffix)));
  if (!found) throw new Error(`[renderer-isolation] missing chunk for ${suffix}`);
  return found;
}

function staticClosure(start: OutputChunk, byFile: ReadonlyMap<string, OutputChunk>): OutputChunk[] {
  const found: OutputChunk[] = [];
  const pending = [start];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const chunk = pending.pop();
    if (!chunk || seen.has(chunk.fileName)) continue;
    addChunkClosure({ chunk, byFile, seen, found, pending });
  }
  return found;
}

interface ChunkClosureState {
  chunk: OutputChunk;
  byFile: ReadonlyMap<string, OutputChunk>;
  seen: Set<string>;
  found: OutputChunk[];
  pending: OutputChunk[];
}

function addChunkClosure({ chunk, byFile, seen, found, pending }: ChunkClosureState): void {
  seen.add(chunk.fileName);
  found.push(chunk);
  for (const imported of chunk.imports) {
    const dependency = byFile.get(imported);
    if (dependency) pending.push(dependency);
  }
}

function runtimes(chunks: readonly OutputChunk[]): Renderer[] {
  const ids = chunks.flatMap((chunk) => Object.keys(chunk.modules).map(normalized));
  const found: Renderer[] = [];
  if (ids.some((id) => id.includes("/node_modules/phaser/"))) found.push("phaser");
  if (ids.some((id) => id.includes("/node_modules/three/"))) found.push("three");
  return found;
}

function assertRuntimes(label: string, chunks: readonly OutputChunk[], expected: Renderer[]): void {
  const actual = runtimes(chunks);
  if (actual.join() === expected.join()) return;
  throw new Error(`[renderer-isolation] ${label} closure has runtimes [${actual.join()}], expected [${expected.join()}]`);
}

function assertDynamicRoute(main: OutputChunk, route: OutputChunk): void {
  if (main.dynamicImports.includes(route.fileName)) return;
  throw new Error(`[renderer-isolation] entry does not dynamically import ${route.fileName}`);
}

function evidence(chunks: readonly OutputChunk[]): RouteEvidence {
  const [root] = chunks;
  if (!root) throw new Error("[renderer-isolation] empty route closure");
  return {
    file: root.fileName,
    bytes: chunks.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0),
    staticImports: chunks.slice(1).map((chunk) => chunk.fileName).sort(),
    runtimes: runtimes(chunks),
  };
}

function normalized(path: string): string {
  return path.replaceAll("\\", "/");
}
