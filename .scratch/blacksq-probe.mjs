// Black-square probe: boot the sandbox at the prod seed, walk the camera to the user's
// repro area, screenshot, then dump per-cell terrain data + which baked textures cover
// each screen cell — finding cells NO texture covers (the black squares).
// Hygiene: all children die in finally; hard self-timeout.
import { chromium } from "@playwright/test";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = "5281";
const kids = [];
const deadline = setTimeout(() => { console.error("SELF-TIMEOUT"); cleanup(); process.exit(2); }, 110_000);

function cleanup() {
  for (const k of kids) { try { execSync(`taskkill /pid ${k.pid} /T /F`, { stdio: "ignore" }); } catch { /* gone */ } }
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server not ready: " + url);
}

async function main() {
  const server = spawn("npm", ["run", "dev", "-w", "@dc2d/game-server"], { cwd: repoRoot, stdio: "ignore", shell: true, env: { ...process.env, DC2D_SEED: "228182761" } });
  kids.push(server);
  const viteJs = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
  const vite = spawn(process.execPath, [viteJs, path.join(repoRoot, "packages", "client"), "--port", PORT, "--strictPort"], { stdio: "ignore" });
  kids.push(vite);
  await waitFor(`http://localhost:${PORT}/`);
  await new Promise((r) => setTimeout(r, 3000));

  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://localhost:${PORT}/?debug=1`);
    await page.waitForFunction(() => window.__dc2d !== undefined, undefined, { timeout: 15000 });
    await page.evaluate(() => { const c = window.__dc2d.conn; c.setName("blacksq-probe"); c.connect("dungeon"); });
    await page.waitForFunction(() => window.__dc2d?.conn.status === "connected" && window.__dc2d.conn.body !== null, undefined, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 5000));

    const shotPath = path.join(repoRoot, ".scratch", "blacksq-view.png");
    // Sweep the camera over a 5x5-screen area, scanning each frame for grid-aligned
    // near-black tiles (threshold 14, 80% coverage) outside HUD regions.
    const { pathToFileURL } = await import("node:url");
    const { PNG } = await import(pathToFileURL(path.join(repoRoot, "tools", "node_modules", "pngjs", "lib", "png.js")).href);
    const found = new Map();
    const base = await page.evaluate(() => {
      const cam = window.__game.scene.getScenes(true).find((s) => s.scene.key === "dungeon").cameras.main;
      return { x: cam.scrollX, y: cam.scrollY, zoom: cam.zoom, w: cam.width, h: cam.height };
    });
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const cam = await page.evaluate(({ bx, by, dx, dy }) => {
          const scene = window.__game.scene.getScenes(true).find((s) => s.scene.key === "dungeon");
          const c = scene.cameras.main;
          c.setScroll(bx + dx * c.width / c.zoom, by + dy * c.height / c.zoom);
          return { scrollX: c.scrollX, scrollY: c.scrollY, zoom: c.zoom };
        }, { bx: base.x, by: base.y, dx: ox, dy: oy });
        await new Promise((r) => setTimeout(r, 1200)); // stream+bake
        const buf = await page.screenshot();
        const img = PNG.sync.read(buf);
        const px = (x, y) => { const i = (img.width * y + x) << 2; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
        const T = 48 * cam.zoom;
        const ox0 = -((cam.scrollX * cam.zoom) % T), oy0 = -((cam.scrollY * cam.zoom) % T);
        for (let sy = oy0; sy + T <= img.height; sy += T) {
          for (let sx = ox0; sx + T <= img.width; sx += T) {
            if (sx < 440 && sy > 460) continue;
            if (sy < 110) continue;
            let dark = 0, total = 0;
            for (let yy = 6; yy < T - 6; yy += 5) for (let xx = 6; xx < T - 6; xx += 5) {
              const [r, g, b] = px(Math.round(sx + xx), Math.round(sy + yy));
              total++; if (Math.max(r, g, b) < 14) dark++;
            }
            if (total > 0 && dark / total > 0.8) {
              const vx = Math.floor((sx / cam.zoom + cam.scrollX) / 48);
              const vy = Math.floor((sy / cam.zoom + cam.scrollY) / 48);
              found.set(vx + "," + vy, { vx, vy });
            }
          }
        }
      }
    }
    const blackCells = [...found.values()];
    const dump = await page.evaluate((cells) => {
      const world = window.__dc2d.conn.world;
      return cells.slice(0, 16).map(({ vx, vy }) => ({
        cell: [vx, vy],
        h: world.heightAt(vx, vy),
        tile: world.tileAt(vx, vy),
        walk: world.isWalkable(vx, vy),
        hN: world.heightAt(vx, vy - 1), hS: world.heightAt(vx, vy + 1),
        hE: world.heightAt(vx + 1, vy), hW: world.heightAt(vx - 1, vy),
        hS2: world.heightAt(vx, vy + 2), tS: world.tileAt(vx, vy + 1), tN: world.tileAt(vx, vy - 1),
      }));
    }, blackCells);
    console.log(JSON.stringify({ blackCellCount: blackCells.length, sample: dump }, null, 1));
    await page.screenshot({ path: shotPath });
  } finally {
    await browser.close();
  }
}

main().then(() => { clearTimeout(deadline); cleanup(); process.exit(0); }).catch((e) => { console.error(e); clearTimeout(deadline); cleanup(); process.exit(1); });
