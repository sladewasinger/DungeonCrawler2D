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
      const chunks = outputChunks(bundle);
      const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const main = routeChunk(chunks, MODULE_SUFFIX.main);
      const phaser = routeChunk(chunks, MODULE_SUFFIX.phaser);
      const three = routeChunk(chunks, MODULE_SUFFIX.three);
      const mainClosure = staticClosure(main, byFile);
      const phaserClosure = staticClosure(phaser, byFile);
      const threeClosure = staticClosure(three, byFile);

      assertDynamicRoute(main, phaser);
      assertDynamicRoute(main, three);
      assertRuntimes("entry", mainClosure, []);
      assertRuntimes("Phaser", phaserClosure, ["phaser"]);
      assertRuntimes("Three", threeClosure, ["three"]);

      this.emitFile({
        type: "asset",
        fileName: "renderer-isolation.json",
        source: `${JSON.stringify({
          entry: evidence(mainClosure),
          routes: { phaser: evidence(phaserClosure), three: evidence(threeClosure) },
        }, null, 2)}\n`,
      });
    },
  };
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
    seen.add(chunk.fileName);
    found.push(chunk);
    for (const imported of chunk.imports) {
      const dependency = byFile.get(imported);
      if (dependency) pending.push(dependency);
    }
  }
  return found;
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
