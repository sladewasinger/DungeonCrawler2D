#!/usr/bin/env node
// Bakes only the standalone particle atlas, so particle art can be iterated without
// requiring the broader sprite-atlas generation inputs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildParticleAtlasJson, generateParticleAtlas } from './lib/particle-atlas.mjs';

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(TOOLS_DIR, '..', 'packages', 'client', 'public', 'assets', 'particles');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { atlas, frames } = generateParticleAtlas();
  atlas.writeFile(path.join(OUT_DIR, 'particle-atlas.png'));
  writeJson(path.join(OUT_DIR, 'particle-atlas.json'), buildParticleAtlasJson(frames));
  console.log(`Wrote ${frames.length} particle frames to ${OUT_DIR}`);
}

run();
