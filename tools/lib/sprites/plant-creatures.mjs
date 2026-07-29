import path from 'node:path';
import { Canvas } from '../png-canvas.mjs';

const FRAME_SIZE = 24;
const IDLE_SEQUENCE = ['idle-0.png', 'recover-0.png', 'idle-0.png', 'recover-0.png'];
const RUN_SEQUENCE = ['walk-0.png', 'walk-1.png', 'walk-0.png', 'walk-1.png'];

function downsample(source) {
  const output = new Canvas(FRAME_SIZE, FRAME_SIZE);
  const scaleX = source.width / FRAME_SIZE;
  const scaleY = source.height / FRAME_SIZE;
  for (let y = 0; y < FRAME_SIZE; y++) {
    for (let x = 0; x < FRAME_SIZE; x++) {
      const sourceX = Math.floor((x + 0.5) * scaleX);
      const sourceY = Math.floor((y + 0.5) * scaleY);
      output.setPixel(x, y, source.getPixel(sourceX, sourceY));
    }
  }
  return output;
}

function pitchPixel([r, g, b, a]) {
  if (a === 0 || g <= r * 1.08 || g <= b * 1.08) return [r, g, b, a];
  const light = Math.max(r, g, b);
  return [
    Math.round(light * 0.42),
    Math.round(light * 0.24),
    Math.round(light * 0.5),
    a,
  ];
}

function pitchVariant(source) {
  const output = new Canvas(source.width, source.height);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      output.setPixel(x, y, pitchPixel(source.getPixel(x, y)));
    }
  }
  return output;
}

function loadFrame(sourceDirectory, filename) {
  return downsample(Canvas.fromFile(path.join(sourceDirectory, filename)));
}

function series({ sourceDirectory, prefix, filenames, transform = (frame) => frame }) {
  return filenames.map((filename, index) => ({
    name: `${prefix}_f${index}`,
    canvas: transform(loadFrame(sourceDirectory, filename)),
  }));
}

/** Restores the authored legacy plant silhouette for both plant enemy families. */
export function generatePlantCreatures(sourceDirectory) {
  return [
    ...series({ sourceDirectory, prefix: 'plant_creeper_idle', filenames: IDLE_SEQUENCE }),
    ...series({ sourceDirectory, prefix: 'plant_creeper_run', filenames: RUN_SEQUENCE }),
    ...series({
      sourceDirectory,
      prefix: 'pitchbloom_idle',
      filenames: IDLE_SEQUENCE,
      transform: pitchVariant,
    }),
    ...series({
      sourceDirectory,
      prefix: 'pitchbloom_run',
      filenames: RUN_SEQUENCE,
      transform: pitchVariant,
    }),
  ];
}
