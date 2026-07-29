// Crisp, non-glowing particle primitives kept separate from the general sprite atlas.
import { Canvas } from './png-canvas.mjs';

const CELL_SIZE = 16;
const COLUMNS = 4;
const ROWS = 2;
const ATLAS_WIDTH = CELL_SIZE * COLUMNS;
const ATLAS_HEIGHT = CELL_SIZE * ROWS;
const OPAQUE_WHITE = [255, 255, 255, 255];

const RECTANGLE_CHUNKS = [
  { name: 'chunk_tiny', width: 2, height: 2 },
  { name: 'chunk_small', width: 4, height: 4 },
  { name: 'chunk_square', width: 6, height: 6 },
  { name: 'chunk_large', width: 8, height: 8 },
  { name: 'chunk_wide', width: 10, height: 4 },
  { name: 'chunk_tall', width: 4, height: 10 },
  { name: 'chunk_bar', width: 12, height: 2 },
];

const SHAPED_CHUNKS = [
  {
    name: 'chunk_diamond',
    pixels: [
      '001100',
      '011110',
      '111111',
      '111111',
      '011110',
      '001100',
    ],
  },
];

function centeredOrigin(cellIndex, width, height) {
  const column = cellIndex % COLUMNS;
  const row = Math.floor(cellIndex / COLUMNS);
  return {
    x: column * CELL_SIZE + Math.floor((CELL_SIZE - width) / 2),
    y: row * CELL_SIZE + Math.floor((CELL_SIZE - height) / 2),
  };
}

function placeRectangle(atlas, cellIndex, chunk) {
  const origin = centeredOrigin(cellIndex, chunk.width, chunk.height);
  atlas.fillRect(origin.x, origin.y, chunk.width, chunk.height, OPAQUE_WHITE);
  return { name: chunk.name, x: origin.x, y: origin.y, w: chunk.width, h: chunk.height };
}

function drawShapeRow({ atlas, origin, row, y }) {
  [...row].forEach((pixel, x) => {
    if (pixel === '1') atlas.setPixel(origin.x + x, origin.y + y, OPAQUE_WHITE);
  });
}

function placeShape(atlas, cellIndex, chunk) {
  const height = chunk.pixels.length;
  const width = chunk.pixels[0].length;
  const origin = centeredOrigin(cellIndex, width, height);
  chunk.pixels.forEach((row, y) => drawShapeRow({ atlas, origin, row, y }));
  return { name: chunk.name, x: origin.x, y: origin.y, w: width, h: height };
}

export function generateParticleAtlas() {
  const atlas = new Canvas(ATLAS_WIDTH, ATLAS_HEIGHT);
  const frames = RECTANGLE_CHUNKS.map((chunk, index) => placeRectangle(atlas, index, chunk));
  const shapedFrames = SHAPED_CHUNKS.map((chunk, index) => placeShape(atlas, RECTANGLE_CHUNKS.length + index, chunk));
  return { atlas, frames: [...frames, ...shapedFrames] };
}

export function buildParticleAtlasJson(frames) {
  const entries = Object.fromEntries(frames.map((frame) => [frame.name, {
    frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
    sourceSize: { w: frame.w, h: frame.h },
  }]));
  return {
    frames: entries,
    meta: {
      app: 'dc2d-particle-bake',
      version: '1.0',
      image: 'particle-atlas.png',
      format: 'RGBA8888',
      size: { w: ATLAS_WIDTH, h: ATLAS_HEIGHT },
      scale: '1',
    },
  };
}
